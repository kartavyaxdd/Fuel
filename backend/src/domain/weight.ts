import type {
  LogWeightRequest,
  WeightData,
  WeightPoint,
  WeightRange,
  WeightStats,
} from '@nutrition/types';
import { WEIGHT_RANGES } from '@nutrition/types';
import { computeWeightTrend, type DailyRecord } from './energyModel';
import { generateSampleHistory } from './sampleData';
import { registerStore, scheduleSave } from './store';

/**
 * In-memory weigh-in store keyed by ISO date. Seeded from the sample history so
 * the demo has a realistic 90-day curve; a real app swaps this for a database
 * while the domain API stays identical.
 */
const WEIGHTS: Map<string, number> = new Map();

function seedFromSample(): void {
  if (WEIGHTS.size > 0) return;
  for (const record of generateSampleHistory()) {
    if (record.weight != null) WEIGHTS.set(record.date, record.weight);
  }
}
seedFromSample();

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
