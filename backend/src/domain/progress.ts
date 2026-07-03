import type {
  CardioEntry,
  LiftEntry,
  LiftPR,
  Measurement,
  ProgressData,
  StreakStats,
} from '@nutrition/types';

// ---------------------------------------------------------------------------
// Deterministic PRNG — same seed used across the app (mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xdeadbeef); // different seed from energyModel

function r(): number {
  return rand();
}

function rInt(min: number, max: number): number {
  return Math.floor(r() * (max - min + 1)) + min;
}

function rChoice<T>(arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ANCHOR = '2026-07-02';
const DAYS = 90;

// ---------------------------------------------------------------------------
// Sample measurements — monthly cadence
// ---------------------------------------------------------------------------

function generateMeasurements(): Measurement[] {
  const out: Measurement[] = [];
  // 3 measurement points: ~90, ~60, ~30, ~0 days ago
  const offsets = [90, 60, 30, 0];
  let waist = 90;
  let hips = 102;
  let chest = 105;
  let arm = 38;
  let thigh = 62;
  let bf = 23;

  for (const offset of offsets) {
    out.push({
      date: addDays(ANCHOR, -offset),
      waist: +waist.toFixed(1),
      hips: +hips.toFixed(1),
      chest: +chest.toFixed(1),
      armLeft: +(arm + r() * 0.4 - 0.2).toFixed(1),
      armRight: +(arm + 0.3 + r() * 0.4).toFixed(1),
      thigh: +thigh.toFixed(1),
      bodyFat: +bf.toFixed(1),
    });
    waist -= r() * 1.2 + 0.3;
    hips -= r() * 0.8 + 0.2;
    chest -= r() * 0.5;
    arm -= r() * 0.3;
    thigh -= r() * 0.6;
    bf -= r() * 0.8 + 0.1;
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Sample lifts
// ---------------------------------------------------------------------------

const LIFTS = ['Squat', 'Bench Press', 'Deadlift', 'OHP', 'Row'];

function epley(weight: number, reps: number): number {
  return reps === 1 ? weight : +(weight * (1 + reps / 30)).toFixed(1);
}

function generateLifts(): LiftEntry[] {
  const out: LiftEntry[] = [];

  // Starting weights (kg)
  const bases: Record<string, number> = {
    Squat: 90,
    'Bench Press': 72,
    Deadlift: 110,
    OHP: 52,
    Row: 68,
  };

  // 3 sessions per week (Mon/Wed/Fri-ish), rotating exercises
  let dayOffset = -90;
  let session = 0;
  while (dayOffset <= 0) {
    const ex = LIFTS[session % LIFTS.length];
    const progressFactor = 1 + (90 + dayOffset) / 90 * 0.06; // ~6% PR improvement over 90 days
    const base = bases[ex] * progressFactor;
    const sets = rInt(3, 4);
    for (let s = 0; s < sets; s++) {
      const reps = rInt(4, 8);
      const wt = +(base + r() * 2.5 - 1.25).toFixed(1);
      out.push({
        date: addDays(ANCHOR, dayOffset),
        exercise: ex,
        weightKg: wt,
        reps,
        oneRepMax: epley(wt, reps),
      });
    }
    session++;
    dayOffset += rInt(1, 3);
  }

  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function computePRs(lifts: LiftEntry[]): LiftPR[] {
  const best = new Map<string, LiftPR>();
  for (const l of lifts) {
    const prev = best.get(l.exercise);
    if (!prev || l.oneRepMax > prev.oneRepMax) {
      best.set(l.exercise, {
        exercise: l.exercise,
        weightKg: l.weightKg,
        reps: l.reps,
        oneRepMax: l.oneRepMax,
        date: l.date,
      });
    }
  }
  return [...best.values()].sort((a, b) => b.oneRepMax - a.oneRepMax);
}

// ---------------------------------------------------------------------------
// Sample cardio / steps
// ---------------------------------------------------------------------------

const CARDIO_TYPES = ['run', 'walk', 'cycle', 'walk', 'run'];

function generateCardio(): CardioEntry[] {
  const out: CardioEntry[] = [];
  for (let i = 0; i < 90; i++) {
    // ~40% of days have cardio
    if (r() > 0.4) continue;
    const type = rChoice(CARDIO_TYPES);
    const durationMin = rInt(20, 55);
    const steps =
      type === 'cycle' ? rInt(0, 500) : rInt(3000, 8000);
    const kcalBurned =
      type === 'cycle'
        ? rInt(180, 320)
        : Math.round(durationMin * (type === 'run' ? 9.5 : 5.5));
    out.push({
      date: addDays(ANCHOR, -i),
      steps: type === 'cycle' ? null : steps,
      durationMin,
      kcalBurned,
      type,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function generateStepTrend(): { date: string; steps: number }[] {
  const out: { date: string; steps: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    out.push({
      date: addDays(ANCHOR, -i),
      steps: rInt(5500, 11000),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

function computeStreaks(
  measurements: Measurement[],
  lifts: LiftEntry[],
  cardio: CardioEntry[],
): StreakStats {
  const active = new Set<string>([
    ...measurements.map((m) => m.date),
    ...lifts.map((l) => l.date),
    ...cardio.map((c) => c.date),
  ]);

  let current = 0;
  let longest = 0;
  let streakStart: string | null = null;
  let run = 0;
  let runStart: string | null = null;

  for (let i = DAYS; i >= 0; i--) {
    const d = addDays(ANCHOR, -i);
    if (active.has(d)) {
      run++;
      if (run === 1) runStart = d;
      if (run > longest) longest = run;
      if (i === 0) {
        // streak still alive at anchor
        current = run;
        streakStart = runStart;
      }
    } else {
      run = 0;
      runStart = null;
    }
  }

  // If latest date == anchor has entry, current is already set above.
  // Otherwise it stays 0.

  return {
    currentStreak: current,
    longestStreak: longest,
    streakStart,
    totalActiveDays: active.size,
  };
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export function generateProgressData(): ProgressData {
  const measurements = generateMeasurements();
  const allLifts = generateLifts();
  const prs = computePRs(allLifts);
  const recentLifts = allLifts.slice(0, 30);
  const cardio = generateCardio();
  const recentCardio = cardio.slice(0, 20);
  const stepTrend = generateStepTrend();
  const streaks = computeStreaks(measurements, allLifts, cardio);

  return {
    generatedAt: new Date().toISOString(),
    latestMeasurement: measurements[measurements.length - 1] ?? null,
    measurements,
    prs,
    recentLifts,
    recentCardio,
    stepTrend,
    streaks,
  };
}
