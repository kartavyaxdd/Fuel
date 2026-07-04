import type {
  FoodDay,
  FoodItem,
  LoggedFood,
  Macros,
  MealGroup,
  MealSlot,
} from '@nutrition/types';
import { MEAL_SLOTS } from '@nutrition/types';
import { getFoodById } from './foodDb';
import { buildDemoDashboard } from './dashboard';
import { getGoal, getGoalForUser } from './userGoal';
import { registerStore, scheduleSave, select, upsert } from './store';
import { recommendedCalorieTarget } from './goals';
import { computeAdaptiveExpenditure } from './energyModel';
import { buildDailyRecords, buildDailyRecordsForUser } from './dailyRecords';
import { isTrainingDay } from './trainingDay';
import { DEMO_ANCHOR_DATE } from './sampleData';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/**
 * In-memory log store keyed by ISO date. This is the demo persistence layer —
 * a real app would swap this for a database, but the domain API stays the same.
 */
const LOG: Map<string, LoggedFood[]> = new Map();

let idCounter = 1;
function nextId(): string {
  return `log-${idCounter++}`;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Scale a food's per-serving macros by a quantity of servings. */
function scaleMacros(food: FoodItem, quantity: number): Macros {
  return {
    calories: Math.round(food.calories * quantity),
    protein: round(food.protein * quantity),
    carbs: round(food.carbs * quantity),
    fat: round(food.fat * quantity),
  };
}

function emptyMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: round(a.protein + b.protein),
    carbs: round(a.carbs + b.carbs),
    fat: round(a.fat + b.fat),
  };
}

/** Append a logged food entry to a day and return the created record. */
export function logFood(
  date: string,
  slot: MealSlot,
  foodId: string,
  quantity: number,
  loggedAt: string,
): LoggedFood {
  const food = getFoodById(foodId);
  if (!food) {
    throw new Error(`Unknown food: ${foodId}`);
  }
  const scaled = scaleMacros(food, quantity);
  const entry: LoggedFood = {
    id: nextId(),
    date,
    slot,
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    quantity,
    servingUnit: food.servingUnit,
    loggedAt,
    ...scaled,
  };
  const day = LOG.get(date) ?? [];
  day.push(entry);
  LOG.set(date, day);
  scheduleSave();
  return entry;
}

/** Clear all logged entries for a date. Returns number of entries removed. */
export function clearDay(date: string): number {
  const day = LOG.get(date);
  if (!day) return 0;
  const count = day.length;
  LOG.delete(date);
  scheduleSave();
  return count;
}

/** Sum of calories logged per date. */
export function getDailyIntakes(): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [date, entries] of LOG) {
    const sum = entries.reduce((s, e) => s + e.calories, 0);
    totals.set(date, sum);
  }
  return totals;
}

/** Clear the entire food log. */
/** All dates that have at least one logged entry. */
export function getAllLogDates(): string[] {
  return [...LOG.keys()].sort();
}

/** Top-N frequently logged foods, optionally weighted by meal slot and recency. */
export function getRecentFoods(
  limit = 10,
  opts?: { slot?: string; maxDays?: number },
): { foodId: string; name: string; count: number; lastDate: string; calories: number; protein: number; carbs: number; fat: number }[] {
  const recentThreshold = opts?.maxDays ? Date.now() - opts.maxDays * 86400000 : 0;
  const freq = new Map<string, { name: string; count: number; slotCount: number; lastDate: string; calories: number; protein: number; carbs: number; fat: number }>();
  for (const [date, entries] of LOG) {
    if (recentThreshold > 0) {
      const d = new Date(`${date}T00:00:00Z`).getTime();
      if (d < recentThreshold) continue;
    }
    for (const e of entries) {
      const cur = freq.get(e.foodId);
      const isNewer = !cur || date > cur.lastDate;
      const baseCount = (cur?.count ?? 0) + 1;
      const slotBonus = opts?.slot && e.slot === opts.slot ? 3 : 0;
      freq.set(e.foodId, {
        name: e.name,
        count: baseCount + slotBonus,
        slotCount: (cur?.slotCount ?? 0) + (opts?.slot && e.slot === opts.slot ? 1 : 0),
        lastDate: isNewer ? date : (cur?.lastDate ?? date),
        calories: isNewer ? e.calories : (cur?.calories ?? e.calories),
        protein: isNewer ? e.protein : (cur?.protein ?? e.protein),
        carbs: isNewer ? e.carbs : (cur?.carbs ?? e.carbs),
        fat: isNewer ? e.fat : (cur?.fat ?? e.fat),
      });
    }
  }
  return [...freq.entries()]
    .map(([foodId, v]) => ({ foodId, name: v.name, count: v.count, lastDate: v.lastDate, calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat }))
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}

export function clearAllFoodLog(): void {
  LOG.clear();
  scheduleSave();
}

/** Remove a logged entry by id from a day. Returns true if it existed. */
export function deleteLoggedFood(date: string, entryId: string): boolean {
  const day = LOG.get(date);
  if (!day) return false;
  const idx = day.findIndex((e) => e.id === entryId);
  if (idx === -1) return false;
  day.splice(idx, 1);
  scheduleSave();
  return true;
}

/** Group a day's entries into meal slots with rolled-up totals. */
function groupBySlot(entries: LoggedFood[]): MealGroup[] {
  return MEAL_SLOTS.map((slot) => {
    const slotEntries = entries
      .filter((e) => e.slot === slot)
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    const totals = slotEntries.reduce(addMacros, emptyMacros());
    return { slot, label: SLOT_LABELS[slot], entries: slotEntries, totals };
  });
}

/** The day's macro targets, sourced from the adaptive dashboard model. */
function targetMacros(): Macros {
  const d = buildDemoDashboard();
  return {
    calories: d.calories.target,
    protein: d.macros.protein.target,
    carbs: d.macros.carbs.target,
    fat: d.macros.fat.target,
  };
}

async function targetMacrosForUser(userId: string): Promise<Macros> {
  const goal = await getGoalForUser(userId);
  const history = await buildDailyRecordsForUser(userId);
  const { expenditureEstimate } = computeAdaptiveExpenditure(history);
  const calorieTarget = recommendedCalorieTarget(expenditureEstimate, goal.mode, isTrainingDay(DEMO_ANCHOR_DATE));
  return {
    calories: calorieTarget,
    protein: Math.round((calorieTarget * 0.3) / 4),
    carbs: Math.round((calorieTarget * 0.4) / 4),
    fat: Math.round((calorieTarget * 0.3) / 9),
  };
}

/** Assemble the full FoodDay payload for a date. */
export function buildFoodDay(date: string): FoodDay {
  const entries = LOG.get(date) ?? [];
  const groups = groupBySlot(entries);
  const consumed = entries.reduce(
    (acc, e) => addMacros(acc, e),
    emptyMacros(),
  );
  const target = targetMacros();
  const remaining: Macros = {
    calories: target.calories - consumed.calories,
    protein: round(target.protein - consumed.protein),
    carbs: round(target.carbs - consumed.carbs),
    fat: round(target.fat - consumed.fat),
  };
  return { date, target, consumed, remaining, groups };
}

/** Copy all of one day's entries into another day (the "copy yesterday" flow). */
export function copyDay(fromDate: string, toDate: string, loggedAt: string): number {
  const source = LOG.get(fromDate) ?? [];
  let copied = 0;
  for (const e of source) {
    logFood(toDate, e.slot, e.foodId, e.quantity, loggedAt);
    copied++;
  }
  return copied;
}

/**
 * Seed a day's log with a realistic set of entries so the food page has
 * content on first load. Idempotent per date.
 */
export function seedDemoDay(date: string): void {
  if (LOG.has(date)) return;
  const ts = (h: number, m: number) =>
    `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  logFood(date, 'breakfast', 'db-greek-yogurt', 1, ts(8, 15));
  logFood(date, 'breakfast', 'db-blueberries', 1, ts(8, 16));
  logFood(date, 'breakfast', 'db-oats', 1, ts(8, 16));
  logFood(date, 'lunch', 'db-chicken-breast', 2, ts(12, 40));
  logFood(date, 'lunch', 'db-white-rice', 2, ts(12, 41));
  logFood(date, 'lunch', 'db-broccoli', 1.5, ts(12, 41));
  logFood(date, 'snack', 'db-whey', 1, ts(16, 0));
  logFood(date, 'snack', 'db-banana', 1, ts(16, 1));
}

interface FoodLogSnapshot {
  idCounter: number;
  days: Record<string, LoggedFood[]>;
}

/**
 * Get today's logged meals for the dashboard (name + macros + time).
 * Returns empty array when no food is logged (fresh reset state).
 */
export function getDayMeals(date: string): { name: string; calories: number; protein: number; carbs: number; fat: number; time: string }[] {
  const entries = LOG.get(date) ?? [];
  return entries.map(e => ({
    name: e.name,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    time: e.loggedAt.includes('T') ? e.loggedAt.split('T')[1].slice(0, 5) : e.loggedAt,
  }));
}

/** Persist the log store: replaces in-memory state with the on-disk snapshot. */
registerStore(
  'foodLog',
  (): FoodLogSnapshot => ({
    idCounter,
    days: Object.fromEntries(LOG.entries()),
  }),
  (data: unknown) => {
    const snapshot = data as FoodLogSnapshot;
    if (!snapshot || typeof snapshot !== 'object') return;
    LOG.clear();
    for (const [date, entries] of Object.entries(snapshot.days ?? {})) {
      if (Array.isArray(entries)) LOG.set(date, entries);
    }
    if (typeof snapshot.idCounter === 'number' && snapshot.idCounter > idCounter) {
      idCounter = snapshot.idCounter;
    }
  },
);

function buildLoggedFoodEntry(date: string, slot: MealSlot, foodId: string, quantity: number, loggedAt: string): LoggedFood {
  const food = getFoodById(foodId);
  if (!food) throw new Error(`Unknown food: ${foodId}`);
  const scaled = scaleMacros(food, quantity);
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date, slot,
    foodId: food.id, name: food.name, brand: food.brand,
    quantity, servingUnit: food.servingUnit, loggedAt,
    ...scaled,
  };
}

function buildFoodDayFromData(log: Map<string, LoggedFood[]>, date: string, target?: Macros): FoodDay {
  const entries = log.get(date) ?? [];
  const groups = groupBySlot(entries);
  const consumed = entries.reduce((acc, e) => addMacros(acc, e), emptyMacros());
  const tgt = target ?? targetMacros();
  return {
    date, target: tgt, consumed,
    remaining: {
      calories: tgt.calories - consumed.calories,
      protein: round(tgt.protein - consumed.protein),
      carbs: round(tgt.carbs - consumed.carbs),
      fat: round(tgt.fat - consumed.fat),
    },
    groups,
  };
}

export async function getFoodLogForUser(userId: string): Promise<Map<string, LoggedFood[]>> {
  const raw = await select('foodLog', userId) as FoodLogSnapshot | null;
  const map = new Map<string, LoggedFood[]>();
  if (raw && typeof raw === 'object') {
    for (const [date, entries] of Object.entries(raw.days ?? {})) {
      if (Array.isArray(entries)) map.set(date, entries);
    }
  }
  return map;
}

export async function logFoodForUser(date: string, slot: MealSlot, foodId: string, quantity: number, loggedAt: string, userId: string): Promise<LoggedFood> {
  const entry = buildLoggedFoodEntry(date, slot, foodId, quantity, loggedAt);
  const log = await getFoodLogForUser(userId);
  const day = log.get(date) ?? [];
  day.push(entry);
  log.set(date, day);
  const snapshot: FoodLogSnapshot = { idCounter: 0, days: Object.fromEntries(log.entries()) };
  await upsert('foodLog', snapshot, userId);
  return entry;
}

export async function clearDayForUser(date: string, userId: string): Promise<number> {
  const log = await getFoodLogForUser(userId);
  const day = log.get(date);
  if (!day) return 0;
  const count = day.length;
  log.delete(date);
  const snapshot: FoodLogSnapshot = { idCounter: 0, days: Object.fromEntries(log.entries()) };
  await upsert('foodLog', snapshot, userId);
  return count;
}

export async function deleteLoggedFoodForUser(date: string, entryId: string, userId: string): Promise<boolean> {
  const log = await getFoodLogForUser(userId);
  const day = log.get(date);
  if (!day) return false;
  const idx = day.findIndex((e) => e.id === entryId);
  if (idx === -1) return false;
  day.splice(idx, 1);
  const snapshot: FoodLogSnapshot = { idCounter: 0, days: Object.fromEntries(log.entries()) };
  await upsert('foodLog', snapshot, userId);
  return true;
}

export async function getDayMealsForUser(date: string, userId: string): Promise<{ name: string; calories: number; protein: number; carbs: number; fat: number; time: string }[]> {
  const log = await getFoodLogForUser(userId);
  const entries = log.get(date) ?? [];
  return entries.map(e => ({
    name: e.name,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    time: e.loggedAt.includes('T') ? e.loggedAt.split('T')[1].slice(0, 5) : e.loggedAt,
  }));
}

export async function buildFoodDayForUser(date: string, userId: string): Promise<FoodDay> {
  const log = await getFoodLogForUser(userId);
  const target = await targetMacrosForUser(userId);
  return buildFoodDayFromData(log, date, target);
}

export async function copyDayForUser(fromDate: string, toDate: string, loggedAt: string, userId: string): Promise<number> {
  const log = await getFoodLogForUser(userId);
  const source = log.get(fromDate) ?? [];
  let copied = 0;
  for (const e of source) {
    await logFoodForUser(toDate, e.slot, e.foodId, e.quantity, loggedAt, userId);
    copied++;
  }
  return copied;
}

export async function getRecentFoodsForUser(limit = 10, opts?: { slot?: string; maxDays?: number }, userId?: string): Promise<{ foodId: string; name: string; count: number; lastDate: string; calories: number; protein: number; carbs: number; fat: number }[]> {
  const log = await getFoodLogForUser(userId ?? '');
  const recentThreshold = opts?.maxDays ? Date.now() - opts.maxDays * 86400000 : 0;
  const freq = new Map<string, { name: string; count: number; slotCount: number; lastDate: string; calories: number; protein: number; carbs: number; fat: number }>();
  for (const [date, entries] of log) {
    if (recentThreshold > 0) {
      const d = new Date(`${date}T00:00:00Z`).getTime();
      if (d < recentThreshold) continue;
    }
    for (const e of entries) {
      const cur = freq.get(e.foodId);
      const isNewer = !cur || date > cur.lastDate;
      const baseCount = (cur?.count ?? 0) + 1;
      const slotBonus = opts?.slot && e.slot === opts.slot ? 3 : 0;
      freq.set(e.foodId, {
        name: e.name,
        count: baseCount + slotBonus,
        slotCount: (cur?.slotCount ?? 0) + (opts?.slot && e.slot === opts.slot ? 1 : 0),
        lastDate: isNewer ? date : (cur?.lastDate ?? date),
        calories: isNewer ? e.calories : (cur?.calories ?? e.calories),
        protein: isNewer ? e.protein : (cur?.protein ?? e.protein),
        carbs: isNewer ? e.carbs : (cur?.carbs ?? e.carbs),
        fat: isNewer ? e.fat : (cur?.fat ?? e.fat),
      });
    }
  }
  return [...freq.entries()]
    .map(([foodId, v]) => ({ foodId, name: v.name, count: v.count, lastDate: v.lastDate, calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat }))
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}

export async function getAllLogDatesForUser(userId: string): Promise<string[]> {
  const log = await getFoodLogForUser(userId);
  return [...log.keys()].sort();
}
