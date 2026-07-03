import type { DailyRecord } from './energyModel';

/**
 * Deterministic pseudo-random generator (mulberry32) so sample data is stable
 * across runs — no Math.random(), so tests and snapshots stay reproducible.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO date `days` before `anchor` (default: the fixed demo anchor). */
function isoDaysBefore(anchor: string, daysBefore: number): string {
  const [y, m, d] = anchor.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - daysBefore);
  return dt.toISOString().split('T')[0];
}

/** The fixed demo anchor date — shared by all modules that need to log to "today" in demo mode. */
export const DEMO_ANCHOR_DATE = '2026-07-02';

export interface SampleHistoryOptions {
  days?: number;
  anchorDate?: string;
  startWeight?: number;
  /** True daily expenditure the simulated user has. */
  trueExpenditure?: number;
  /** Average intake the simulated user eats. */
  avgIntake?: number;
  seed?: number;
}

/**
 * Generate a realistic day-by-day history for a user in a mild deficit:
 * intake wobbles around a mean, weight follows energy balance plus daily noise
 * (water, glycogen, etc.). This is what feeds the adaptive model in the demo.
 */
export function generateSampleHistory(
  opts: SampleHistoryOptions = {},
): DailyRecord[] {
  const {
    days = 90,
    anchorDate = DEMO_ANCHOR_DATE,
    startWeight = 84,
    trueExpenditure = 2750,
    avgIntake = 2200,
    seed = 1337,
  } = opts;

  const rand = mulberry32(seed);
  const KCAL_PER_KG = 7700;
  const records: DailyRecord[] = [];
  let weight = startWeight;

  for (let i = 0; i < days; i++) {
    // Intake wobbles +/- ~250 kcal, with occasional higher weekend days.
    const dayOfWeek = i % 7;
    const weekendBump = dayOfWeek === 5 || dayOfWeek === 6 ? 200 : 0;
    const intake = Math.round(
      avgIntake + weekendBump + (rand() - 0.5) * 500,
    );

    // Energy balance drives the underlying mass; noise simulates water/glycogen.
    const balance = intake - trueExpenditure;
    const massChange = balance / KCAL_PER_KG;
    const noise = (rand() - 0.5) * 0.6; // +/- 0.3 kg daily scale noise
    weight = weight + massChange;

    // ~15% of days have no weigh-in.
    const skipWeighIn = rand() < 0.15;
    const scale = skipWeighIn ? null : round(weight + noise, 1);

    records.push({
      date: isoDaysBefore(anchorDate, days - 1 - i),
      intake,
      weight: scale,
    });
  }

  return records;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
