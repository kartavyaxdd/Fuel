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
import { registerStore, scheduleSave } from './store';

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

/** Clear the entire food log. */
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
