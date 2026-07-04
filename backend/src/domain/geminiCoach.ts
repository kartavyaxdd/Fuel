import { GoogleGenerativeAI, type GenerativeModel, type Part } from '@google/generative-ai';
import type { MealSlot } from '@nutrition/types';
import { searchFoodsLive } from './foodSearch';
import { getFoodById } from './foodDb';
import { logFood, logFoodForUser } from './foodLog';
import { getGoal, getGoalForUser } from './userGoal';
import { buildCoach } from './coach';
import { computeWeightTrend, computeAdaptiveExpenditure } from './energyModel';
import { buildDailyRecords, buildDailyRecordsForUser } from './dailyRecords';
import { DEMO_ANCHOR_DATE } from './sampleData';
import { estimateEtaWeeks } from './goals';
import { getLatestMeasurement, getMeasurementsForUser } from './measurements';
import { isTrainingDay } from './trainingDay';

const MODEL_NAME = 'gemini-2.5-flash';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

function initGemini(): void {
  if (model) return;
  const key = apiKey();
  if (!key) return;
  genAI = new GoogleGenerativeAI(key);
  model = genAI.getGenerativeModel({ model: MODEL_NAME });
}

export function isCoachEnabled(): boolean {
  initGemini();
  const key = apiKey();
  return model != null && key != null && key.length > 0;
}

/* ------------------------------------------------------- Photo food analysis */

export interface IdentifiedFood {
  name: string;
  estimatedCalories: number;
  estimatedProtein: number;
  estimatedCarbs: number;
  estimatedFat: number;
  servingSize: string;
  confidence: number;
}

export interface PhotoAnalysisResult {
  foods: IdentifiedFood[];
}

function extractJson(text: string): IdentifiedFood[] {
  const trimmed = text.trim();
  let json = trimmed;
  const blockMatch = trimmed.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (blockMatch) json = blockMatch[1];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as IdentifiedFood[];
    if (parsed && typeof parsed === 'object' && 'foods' in parsed) return (parsed as { foods: IdentifiedFood[] }).foods;
    return [];
  } catch {
    const arrMatch = json.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]) as IdentifiedFood[]; } catch { return []; }
    }
    return [];
  }
}

export async function analyzeFoodPhoto(
  imageBase64: string,
  mimeType: string,
): Promise<PhotoAnalysisResult> {
  initGemini();
  if (!model) throw new Error('Gemini not available. Set GEMINI_API_KEY.');

  const prompt = `You are a food identification AI. Analyze this food image carefully.

For each distinct food item visible in the image, return a JSON array with:
- name: the food name (e.g. "Grilled chicken breast")
- estimatedCalories: kcal per typical single serving
- estimatedProtein: grams per serving
- estimatedCarbs: grams per serving
- estimatedFat: grams per serving
- servingSize: human-readable description (e.g. "150g", "1 cup", "1 piece")
- confidence: 0.0 to 1.0

Rules:
- Use realistic macro data from standard nutrition references
- Be conservative with portion estimates — slightly under rather than over
- If a dish has multiple components list each separately
- If you cannot identify something omit it
- Return ONLY valid JSON with no markdown no explanation

Example:
[{"name":"Grilled chicken breast","estimatedCalories":165,"estimatedProtein":31,"estimatedCarbs":0,"estimatedFat":3.6,"servingSize":"150g","confidence":0.95}]`;

  const parts: Part[] = [
    { text: prompt },
    { inlineData: { mimeType, data: imageBase64 } },
  ];

  const result = await model.generateContent(parts);
  const text = result.response.text();
  return { foods: extractJson(text) };
}

/* ------------------------------------------------------------------ Helpers */

/** Return demo "today" date — same as the food log's demo anchor. */
function demoToday(): string {
  return DEMO_ANCHOR_DATE;
}

interface CoachContext {
  mode: string;
  targetWeight: number;
  targetBodyFat: number | undefined;
  startWeight: number;
  startDate: string;
  currentWeight: number | null;
  currentBodyFat: number | null;
  weeksToGoal: number | string;
  avgIntake: number | null;
  avgExpenditure: number | null;
  adherence: number;
  energyBalance: number | null;
  weightTrendDelta: number;
  recommended: number;
  protein: number;
  carbs: number;
  fat: number;
  verdict: string;
  weeklyWeightHistory: string;
  intakeHistory: string;
  confidence: number;
  latestMeasurements: string;
}

function buildCoachContext(): CoachContext {
  const goal = getGoal();
  const history = buildDailyRecords();
  const coachData = buildCoach(history, {
    mode: goal.mode,
    targetWeight: goal.targetWeight,
  });

  const trendPoints = computeWeightTrend(history);
  const currentWeight =
    trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].trend : null;

  // ETA calculation
  let weeksToGoal: number | string = 'N/A';
  if (currentWeight != null && currentWeight !== goal.targetWeight) {
    const eta = estimateEtaWeeks(currentWeight, goal.targetWeight, trendPoints);
    weeksToGoal = eta != null ? Math.round(eta) : 'stalled';
  }

  // Last 12 weeks of weight trend for coach context
  const weeklyWeightHistory = trendPoints
    .filter((_, i) => i % 7 === 0)
    .slice(-12)
    .map((p) => `${p.date}: ${p.trend.toFixed(1)} kg`)
    .join('\n');

  // Last 30 days of intake
  const intakeHistory = history
    .slice(-30)
    .filter((r) => r.intake != null)
    .map((r) => `${r.date}: ${Math.round(r.intake!)} kcal`)
    .join('\n');

  const { expenditureEstimate, confidence } = computeAdaptiveExpenditure(history);

  // Latest body measurements
  const latestM = getLatestMeasurement();
  const latestMeasurements = latestM
    ? [
        latestM.date,
        latestM.waist != null ? `waist: ${latestM.waist} cm` : null,
        latestM.chest != null ? `chest: ${latestM.chest} cm` : null,
        latestM.armLeft != null ? `arm: ${latestM.armLeft} cm` : null,
        latestM.hips != null ? `hips: ${latestM.hips} cm` : null,
        latestM.bodyFat != null ? `BF%: ${latestM.bodyFat}%` : null,
      ].filter(Boolean).join(' | ')
    : 'No measurements logged yet.';

  return {
    mode: goal.mode,
    targetWeight: goal.targetWeight,
    targetBodyFat: goal.targetBodyFat,
    startWeight: goal.startWeight,
    startDate: goal.startDate,
    currentWeight,
    currentBodyFat: latestM?.bodyFat ?? null,
    weeksToGoal,
    avgIntake: coachData.checkIn.avgIntake,
    avgExpenditure: coachData.checkIn.avgExpenditure ?? expenditureEstimate,
    adherence: coachData.checkIn.adherence,
    energyBalance: coachData.checkIn.energyBalance,
    weightTrendDelta: coachData.checkIn.weightTrendDelta,
    recommended: coachData.targets.recommended,
    protein: coachData.targets.protein,
    carbs: coachData.targets.carbs,
    fat: coachData.targets.fat,
    verdict: coachData.checkIn.verdict,
    weeklyWeightHistory,
    intakeHistory,
    confidence,
    latestMeasurements,
  };
}

async function buildCoachContextForUser(userId: string): Promise<CoachContext> {
  const goal = await getGoalForUser(userId);
  const history = await buildDailyRecordsForUser(userId);
  const coachData = buildCoach(history, {
    mode: goal.mode,
    targetWeight: goal.targetWeight,
  });

  const trendPoints = computeWeightTrend(history);
  const currentWeight =
    trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].trend : null;

  let weeksToGoal: number | string = 'N/A';
  if (currentWeight != null && currentWeight !== goal.targetWeight) {
    const eta = estimateEtaWeeks(currentWeight, goal.targetWeight, trendPoints);
    weeksToGoal = eta != null ? Math.round(eta) : 'stalled';
  }

  const weeklyWeightHistory = trendPoints
    .filter((_, i) => i % 7 === 0)
    .slice(-12)
    .map((p) => `${p.date}: ${p.trend.toFixed(1)} kg`)
    .join('\n');

  const intakeHistory = history
    .slice(-30)
    .filter((r) => r.intake != null)
    .map((r) => `${r.date}: ${Math.round(r.intake!)} kcal`)
    .join('\n');

  const { expenditureEstimate, confidence } = computeAdaptiveExpenditure(history);

  const measurements = await getMeasurementsForUser(userId);
  const latestM = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const latestMeasurements = latestM
    ? [
        latestM.date,
        latestM.waist != null ? `waist: ${latestM.waist} cm` : null,
        latestM.chest != null ? `chest: ${latestM.chest} cm` : null,
        latestM.armLeft != null ? `arm: ${latestM.armLeft} cm` : null,
        latestM.hips != null ? `hips: ${latestM.hips} cm` : null,
        latestM.bodyFat != null ? `BF%: ${latestM.bodyFat}%` : null,
      ].filter(Boolean).join(' | ')
    : 'No measurements logged yet.';

  return {
    mode: goal.mode,
    targetWeight: goal.targetWeight,
    targetBodyFat: goal.targetBodyFat,
    startWeight: goal.startWeight,
    startDate: goal.startDate,
    currentWeight,
    currentBodyFat: latestM?.bodyFat ?? null,
    weeksToGoal,
    avgIntake: coachData.checkIn.avgIntake,
    avgExpenditure: coachData.checkIn.avgExpenditure ?? expenditureEstimate,
    adherence: coachData.checkIn.adherence,
    energyBalance: coachData.checkIn.energyBalance,
    weightTrendDelta: coachData.checkIn.weightTrendDelta,
    recommended: coachData.targets.recommended,
    protein: coachData.targets.protein,
    carbs: coachData.targets.carbs,
    fat: coachData.targets.fat,
    verdict: coachData.checkIn.verdict,
    weeklyWeightHistory,
    intakeHistory,
    confidence,
    latestMeasurements,
  };
}

function buildSystemPrompt(): string {
  const ctx = buildCoachContext();

  const daysOnPlan = (() => {
    const start = new Date(ctx.startDate);
    const anchor = new Date(DEMO_ANCHOR_DATE);
    return Math.max(0, Math.round((anchor.getTime() - start.getTime()) / 86400000));
  })();

  const progressKg = ctx.currentWeight != null
    ? (ctx.startWeight - ctx.currentWeight).toFixed(1)
    : '?';

  const adherencePct = Math.round(ctx.adherence * 100);
  const isSlipping = ctx.adherence < 0.6;
  const isOffTrack = ctx.weightTrendDelta > 0 && ctx.mode === 'fat-loss';
  const isBrutal = isSlipping || isOffTrack;

  const aestheticGoal = ctx.targetBodyFat != null;
  const bfStatus = ctx.currentBodyFat != null
    ? `${ctx.currentBodyFat}% → target ${ctx.targetBodyFat ?? '?'}%`
    : ctx.targetBodyFat != null
      ? `Target: ${ctx.targetBodyFat}% (log measurements to track)`
      : null;

  return `You are BRUTAL COACH — an elite, no-bullshit AI nutrition coach powered by the user's REAL calorie, weight, and body composition data. You are NOT a generic assistant. You hold the user accountable with precision.

${aestheticGoal ? `⚡ AESTHETIC PHYSIQUE FOCUS — This user's primary goal is body composition, not just weight. They want to be lean, muscular, and defined — not just lighter. Track protein and body fat % as the primary metrics. Weight on the scale is secondary to how they look and what the measurements show.` : ''}

═══════════════════════════════════════════
USER'S GOAL & PROGRESS
═══════════════════════════════════════════
Goal mode:        ${ctx.mode}
Goal weight:      ${ctx.targetWeight} kg${ctx.targetBodyFat != null ? `\nTarget body fat:  ${ctx.targetBodyFat}%` : ''}
Start weight:     ${ctx.startWeight} kg on ${ctx.startDate} (${daysOnPlan} days ago)
Current trend:    ${ctx.currentWeight?.toFixed(1) ?? '?'} kg${bfStatus ? `\nCurrent body fat: ${bfStatus}` : ''}
Total progress:   ${progressKg} kg so far
ETA to goal:      ${ctx.weeksToGoal} weeks

═══════════════════════════════════════════
LATEST BODY MEASUREMENTS
═══════════════════════════════════════════
${ctx.latestMeasurements}

═══════════════════════════════════════════
METABOLIC SNAPSHOT (derived from training data)
═══════════════════════════════════════════
Avg daily intake:        ${ctx.avgIntake != null ? Math.round(ctx.avgIntake) + ' kcal' : 'N/A'}
Estimated expenditure:   ${ctx.avgExpenditure != null ? Math.round(ctx.avgExpenditure) + ' kcal' : 'N/A'}
Energy balance:          ${ctx.energyBalance != null ? (ctx.energyBalance > 0 ? '+' : '') + Math.round(ctx.energyBalance) + ' kcal/day' : 'N/A'}
7-day weight trend:      ${ctx.weightTrendDelta > 0 ? '+' : ''}${ctx.weightTrendDelta.toFixed(2)} kg
Adherence (7d):          ${adherencePct}%
Model confidence:        ${Math.round(ctx.confidence * 100)}%

TODAY: ${isTrainingDay(DEMO_ANCHOR_DATE) ? '🏋️ TRAINING DAY — targets are elevated (+250 kcal, +20g protein, more carbs)' : '😴 REST DAY — standard targets'}

RECOMMENDED TARGETS:
  Calories: ${ctx.recommended} kcal/day
  Protein:  ${ctx.protein}g  ← NON-NEGOTIABLE for muscle retention
  Carbs:    ${ctx.carbs}g
  Fat:      ${ctx.fat}g

═══════════════════════════════════════════
WEEKLY WEIGHT HISTORY (trend-smoothed)
═══════════════════════════════════════════
${ctx.weeklyWeightHistory}

═══════════════════════════════════════════
LAST 30 DAYS INTAKE LOG
═══════════════════════════════════════════
${ctx.intakeHistory}

═══════════════════════════════════════════
COACH'S READ ON THE USER RIGHT NOW
═══════════════════════════════════════════
${ctx.verdict}

${isBrutal ? `⚠️ USER IS SLIPPING — BRUTAL MODE ON. Adherence: ${adherencePct}%. Do NOT coddle.` : `✅ User is on track. Be firm but encouraging.`}

═══════════════════════════════════════════
TONE RULES (NON-NEGOTIABLE)
═══════════════════════════════════════════
${isBrutal ? `
BRUTAL — The user is failing. You are ALLOWED and EXPECTED to:
- Swear (f*ck, sh*t, damn — not slurs)
- Shame specific behaviors with SPECIFIC data ("You ate 2800 kcal three days this week. That's why you're not losing fat.")
- Be blunt: "Stop making excuses. Hit your target today."
- Refuse to sugarcoat
` : `
FIRM — User is on track. Be direct, precise, no fluff. Credit real progress but push for more.
`}
${aestheticGoal ? `
AESTHETIC COACHING RULES:
- PROTEIN IS THE PRIORITY. Never let them slip below their protein target. Losing muscle while cutting = failure.
- When scale weight stalls but waist measurement drops, that's a WIN. Say so explicitly.
- Remind them: 10-12% BF is achievable but requires consistency for months, not weeks.
- If they're close to target BF%, protect the muscle — drop deficit, not protein.
- Reference body fat % and measurements, not just weight.
- Never say "lose weight" — say "drop body fat" or "get leaner".
` : ''}
- NEVER use emojis
- NEVER say "Let's" or "We can" — address the user as "you"
- Responses: 1-3 short paragraphs max. Be dense, not verbose.
- When the user mentions food they ate, use the log_food tool to log it without asking.
- Today's date for logging: ${demoToday()}

AVAILABLE TOOL: log_food(name, slot, quantity, date?)
Use it immediately when the user says they ate something. Infer the slot from context (morning=breakfast, noon=lunch, evening=dinner, otherwise=snack). Default date is ${demoToday()}.`;
}

async function buildSystemPromptForUser(userId: string): Promise<string> {
  const ctx = await buildCoachContextForUser(userId);

  const daysOnPlan = (() => {
    const start = new Date(ctx.startDate);
    const anchor = new Date(DEMO_ANCHOR_DATE);
    return Math.max(0, Math.round((anchor.getTime() - start.getTime()) / 86400000));
  })();

  const progressKg = ctx.currentWeight != null
    ? (ctx.startWeight - ctx.currentWeight).toFixed(1)
    : '?';

  const adherencePct = Math.round(ctx.adherence * 100);
  const isSlipping = ctx.adherence < 0.6;
  const isOffTrack = ctx.weightTrendDelta > 0 && ctx.mode === 'fat-loss';
  const isBrutal = isSlipping || isOffTrack;

  const aestheticGoal = ctx.targetBodyFat != null;
  const bfStatus = ctx.currentBodyFat != null
    ? `${ctx.currentBodyFat}% → target ${ctx.targetBodyFat ?? '?'}%`
    : ctx.targetBodyFat != null
      ? `Target: ${ctx.targetBodyFat}% (log measurements to track)`
      : null;

  return `You are BRUTAL COACH — an elite, no-bullshit AI nutrition coach powered by the user's REAL calorie, weight, and body composition data. You are NOT a generic assistant. You hold the user accountable with precision.

${aestheticGoal ? `⚡ AESTHETIC PHYSIQUE FOCUS — This user's primary goal is body composition, not just weight. They want to be lean, muscular, and defined — not just lighter. Track protein and body fat % as the primary metrics. Weight on the scale is secondary to how they look and what the measurements show.` : ''}

═══════════════════════════════════════════
USER'S GOAL & PROGRESS
═══════════════════════════════════════════
Goal mode:        ${ctx.mode}
Goal weight:      ${ctx.targetWeight} kg${ctx.targetBodyFat != null ? `\nTarget body fat:  ${ctx.targetBodyFat}%` : ''}
Start weight:     ${ctx.startWeight} kg on ${ctx.startDate} (${daysOnPlan} days ago)
Current trend:    ${ctx.currentWeight?.toFixed(1) ?? '?'} kg${bfStatus ? `\nCurrent body fat: ${bfStatus}` : ''}
Total progress:   ${progressKg} kg so far
ETA to goal:      ${ctx.weeksToGoal} weeks

═══════════════════════════════════════════
LATEST BODY MEASUREMENTS
═══════════════════════════════════════════
${ctx.latestMeasurements}

═══════════════════════════════════════════
METABOLIC SNAPSHOT (derived from training data)
═══════════════════════════════════════════
Avg daily intake:        ${ctx.avgIntake != null ? Math.round(ctx.avgIntake) + ' kcal' : 'N/A'}
Estimated expenditure:   ${ctx.avgExpenditure != null ? Math.round(ctx.avgExpenditure) + ' kcal' : 'N/A'}
Energy balance:          ${ctx.energyBalance != null ? (ctx.energyBalance > 0 ? '+' : '') + Math.round(ctx.energyBalance) + ' kcal/day' : 'N/A'}
7-day weight trend:      ${ctx.weightTrendDelta > 0 ? '+' : ''}${ctx.weightTrendDelta.toFixed(2)} kg
Adherence (7d):          ${adherencePct}%
Model confidence:        ${Math.round(ctx.confidence * 100)}%

TODAY: ${isTrainingDay(DEMO_ANCHOR_DATE) ? '🏋️ TRAINING DAY — targets are elevated (+250 kcal, +20g protein, more carbs)' : '😴 REST DAY — standard targets'}

RECOMMENDED TARGETS:
  Calories: ${ctx.recommended} kcal/day
  Protein:  ${ctx.protein}g  ← NON-NEGOTIABLE for muscle retention
  Carbs:    ${ctx.carbs}g
  Fat:      ${ctx.fat}g

═══════════════════════════════════════════
WEEKLY WEIGHT HISTORY (trend-smoothed)
═══════════════════════════════════════════
${ctx.weeklyWeightHistory}

═══════════════════════════════════════════
LAST 30 DAYS INTAKE LOG
═══════════════════════════════════════════
${ctx.intakeHistory}

═══════════════════════════════════════════
COACH'S READ ON THE USER RIGHT NOW
═══════════════════════════════════════════
${ctx.verdict}

${isBrutal ? `⚠️ USER IS SLIPPING — BRUTAL MODE ON. Adherence: ${adherencePct}%. Do NOT coddle.` : `✅ User is on track. Be firm but encouraging.`}

═══════════════════════════════════════════
TONE RULES (NON-NEGOTIABLE)
═══════════════════════════════════════════
${isBrutal ? `
BRUTAL — The user is failing. You are ALLOWED and EXPECTED to:
- Swear (f*ck, sh*t, damn — not slurs)
- Shame specific behaviors with SPECIFIC data ("You ate 2800 kcal three days this week. That's why you're not losing fat.")
- Be blunt: "Stop making excuses. Hit your target today."
- Refuse to sugarcoat
` : `
FIRM — User is on track. Be direct, precise, no fluff. Credit real progress but push for more.
`}
${aestheticGoal ? `
AESTHETIC COACHING RULES:
- PROTEIN IS THE PRIORITY. Never let them slip below their protein target. Losing muscle while cutting = failure.
- When scale weight stalls but waist measurement drops, that's a WIN. Say so explicitly.
- Remind them: 10-12% BF is achievable but requires consistency for months, not weeks.
- If they're close to target BF%, protect the muscle — drop deficit, not protein.
- Reference body fat % and measurements, not just weight.
- Never say "lose weight" — say "drop body fat" or "get leaner".
` : ''}
- NEVER use emojis
- NEVER say "Let's" or "We can" — address the user as "you"
- Responses: 1-3 short paragraphs max. Be dense, not verbose.
- When the user mentions food they ate, use the log_food tool to log it without asking.
- Today's date for logging: ${demoToday()}

AVAILABLE TOOL: log_food(name, slot, quantity, date?)
Use it immediately when the user says they ate something. Infer the slot from context (morning=breakfast, noon=lunch, evening=dinner, otherwise=snack). Default date is ${demoToday()}.`;
}

/* --------------------------------------------------- Tool: log_food handler */

export type ProgressEvent =
  | { type: 'thinking' }
  | { type: 'searching'; query: string }
  | { type: 'found'; name: string; calories: number; protein: number; carbs: number; fat: number }
  | { type: 'logging'; name: string; slot: string; quantity: number }
  | { type: 'logged'; name: string; slot: string; calories: number; protein: number; carbs: number; fat: number }
  | { type: 'error'; message: string }
  | { type: 'reply'; text: string };

async function handleLogFood(
  args: { name: string; slot: MealSlot; quantity: number; date?: string },
  onProgress?: (e: ProgressEvent) => void,
  userId?: string,
): Promise<string> {
  try {
    onProgress?.({ type: 'searching', query: args.name });

    const results = await searchFoodsLive(args.name, 5);
    if (results.length === 0) {
      const msg = `No food found matching "${args.name}". Try a different name.`;
      onProgress?.({ type: 'error', message: msg });
      return msg;
    }

    const match =
      results.find((f) => f.name.toLowerCase() === args.name.toLowerCase()) ?? results[0];

    onProgress?.({ type: 'found', name: match.name, calories: match.calories, protein: match.protein, carbs: match.carbs, fat: match.fat });

    const food = getFoodById(match.id);
    if (!food) {
      const msg = `Couldn't resolve food "${match.name}" (id: ${match.id}). Try again.`;
      onProgress?.({ type: 'error', message: msg });
      return msg;
    }

    onProgress?.({ type: 'logging', name: food.name, slot: args.slot, quantity: args.quantity });

    const date = args.date ?? demoToday();
    const loggedAt = new Date().toISOString();
    const entry = userId
      ? await logFoodForUser(date, args.slot, food.id, args.quantity, loggedAt, userId)
      : logFood(date, args.slot, food.id, args.quantity, loggedAt);

    onProgress?.({ type: 'logged', name: entry.name, slot: entry.slot, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat });

    return `Logged: ${entry.quantity}x "${entry.name}" → ${entry.slot} on ${date} | ${entry.calories} kcal | P:${entry.protein}g C:${entry.carbs}g F:${entry.fat}g`;
  } catch (err) {
    const msg = `Failed to log food: ${err instanceof Error ? err.message : String(err)}`;
    onProgress?.({ type: 'error', message: msg });
    return msg;
  }
}

/* ----------------------------------------------------------------- Chat API */

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const TOOL_CONFIG = {
  functionDeclarations: [
    {
      name: 'log_food',
      description:
        'Log a food item to the user\'s food diary. Call this immediately when the user mentions eating something — do NOT ask for confirmation first.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the food to search for and log.' },
          slot: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
            description: 'Meal slot. Infer from time context (morning→breakfast, noon→lunch, evening→dinner, else→snack).',
          },
          quantity: {
            type: 'number',
            description: 'Number of servings to log. Infer from context (e.g. "2 eggs" = quantity 2).',
          },
          date: {
            type: 'string',
            description: `ISO date (YYYY-MM-DD). Default: ${demoToday()}.`,
          },
        },
        required: ['name', 'slot', 'quantity'],
      },
    },
  ],
};

/**
 * Main chat entrypoint. Emits progress events via onProgress callback.
 * Caller can stream these as SSE to the client.
 */
export async function chatWithCoach(
  message: string,
  sessionHistory: ChatMessage[] = [],
  onProgress?: (e: ProgressEvent) => void,
  userId?: string,
): Promise<string> {
  initGemini();
  if (!model) throw new Error('Coach unavailable. Set GEMINI_API_KEY.');

  onProgress?.({ type: 'thinking' });

  const systemPrompt = userId ? await buildSystemPromptForUser(userId) : buildSystemPrompt();

  const historyParts: { role: 'user' | 'model'; parts: { text: string }[] }[] = [
    { role: 'user', parts: [{ text: systemPrompt + '\n\nAcknowledge with "Ready."' }] },
    { role: 'model', parts: [{ text: 'Ready.' }] },
  ];
  for (const msg of sessionHistory) {
    historyParts.push({ role: msg.role, parts: [{ text: msg.text }] });
  }

  const chat = model.startChat({ history: historyParts, tools: TOOL_CONFIG as any });

  const result = await chat.sendMessage(message);
  let responseText = result.response.text();

  const calls = result.response.functionCalls() ?? [];
  if (calls.length > 0) {
    const functionResponses: Part[] = [];
    for (const call of calls) {
      if (call.name === 'log_food') {
        const args = call.args as { name: string; slot: MealSlot; quantity: number; date?: string };
        const toolResult = await handleLogFood(args, onProgress, userId);
        functionResponses.push({
          functionResponse: { name: call.name, response: { result: toolResult } },
        });
      }
    }
    if (functionResponses.length > 0) {
      const followUp = await chat.sendMessage(functionResponses);
      responseText = followUp.response.text();
    }
  }

  onProgress?.({ type: 'reply', text: responseText });
  return responseText;
}
