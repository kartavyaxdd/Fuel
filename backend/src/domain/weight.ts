import type {
  LogWeightRequest,
  WeightData,
  WeightPoint,
  WeightRange,
  WeightStats,
} from '@nutrition/types';
import { WEIGHT_RANGES } from '@nutrition/types';
import { computeWeightTrend, type DailyRecord } from './energyModel';
import { registerStore, scheduleSave, select, upsert } from './store';
import { withUserLock } from './mutex';

/**
 * In-memory weigh-in store keyed by ISO date. Starts empty — users log
 * their first weigh-in via POST /api/weight.
 */
const WEIGHTS: Map<string, number> = new Map();

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** All stored weigh-ins as DailyRecords, ascending by date. */
function toRecords(): DailyRecord[] {
  return [...WEIGHTS.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weight]) => ({ date, intake: null, weight }));
}

/** All stored weigh-ins as DailyRecords, ascending by date (intake always null). */
export function getWeightRecords(): DailyRecord[] {
  return [...WEIGHTS.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weight]) => ({ date, intake: null, weight }));
}

function isValidRange(value: number): value is WeightRange {
  return (WEIGHT_RANGES as number[]).includes(value);
}

export function normalizeRange(value: unknown): WeightRange {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return isValidRange(n) ? n : 90;
}

/** Clear all weigh-in data. */
export function clearAllWeights(): void {
  WEIGHTS.clear();
  scheduleSave();
}

/** Record (or overwrite) a weigh-in for a given day. */
export function logWeight(req: LogWeightRequest): void {
  WEIGHTS.set(req.date, req.weight);
  scheduleSave();
}

function computeStats(series: WeightPoint[], windowDays: number): WeightStats {
  const trends = series.map((p) => p.trend);
  const scales = series.filter((p) => p.scale != null);
  const currentTrend = trends.length ? trends[trends.length - 1] : 0;

  const weekAgoIndex = Math.max(0, series.length - 8);
  const weeklyRate = series.length
    ? currentTrend - trends[weekAgoIndex]
    : 0;
  const totalChange = trends.length ? currentTrend - trends[0] : 0;

  return {
    currentTrend: round(currentTrend),
    latestScale: scales.length ? scales[scales.length - 1].scale : null,
    weeklyRate: round(weeklyRate),
    totalChange: round(totalChange),
    lowestTrend: trends.length ? round(Math.min(...trends)) : 0,
    highestTrend: trends.length ? round(Math.max(...trends)) : 0,
    entriesLogged: scales.length,
    windowDays,
  };
}

/**
 * Build the weight view for a range: compute the trend over the FULL history
 * (so the EMA is warmed up), then slice to the requested window.
 */
export function buildWeightData(range: WeightRange): WeightData {
  const records = toRecords();
  const fullTrend = computeWeightTrend(records);
  const series = fullTrend.slice(-range).map((p) => ({
    date: p.date,
    scale: p.scale,
    trend: round(p.trend),
  }));

  const latestDate = records.length ? records[records.length - 1].date : '';

  return {
    date: latestDate,
    range,
    series,
    stats: computeStats(series, range),
    unit: 'kg',
  };
}

export async function getWeightRecordsForUser(userId: string): Promise<DailyRecord[]> {
  const raw = await select('weight', userId) as Record<string, number> | null;
  const weights = new Map(Object.entries(raw ?? {}));
  return [...weights.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weight]) => ({ date, intake: null, weight }));
}

export async function logWeightForUser(req: LogWeightRequest, userId: string): Promise<void> {
  return withUserLock(userId, async () => {
    const raw = await select('weight', userId) as Record<string, number> | null;
    const weights = raw ?? {};
    weights[req.date] = req.weight;
    await upsert('weight', weights, userId);
  });
}

export async function buildWeightDataForUser(range: WeightRange, userId: string): Promise<WeightData> {
  const records = await getWeightRecordsForUser(userId);
  const fullTrend = computeWeightTrend(records);
  const series = fullTrend.slice(-range).map((p) => ({
    date: p.date,
    scale: p.scale,
    trend: round(p.trend),
  }));
  const latestDate = records.length ? records[records.length - 1].date : '';
  return {
    date: latestDate,
    range,
    series,
    stats: computeStats(series, range),
    unit: 'kg',
  };
}

export async function clearAllWeightsForUser(userId: string): Promise<void> {
  await upsert('weight', {}, userId);
}

/** Persist the weigh-in store as a date→weight map. */
registerStore(
  'weight',
  (): Record<string, number> => Object.fromEntries(WEIGHTS.entries()),
  (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    WEIGHTS.clear();
    for (const [date, weight] of Object.entries(data as Record<string, number>)) {
      if (typeof weight === 'number') WEIGHTS.set(date, weight);
    }
  },
);
