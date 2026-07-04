/** A single body measurement entry. */
export interface Measurement {
  date: string;
  /** Waist circumference in cm. */
  waist: number | null;
  /** Hip circumference in cm. */
  hips: number | null;
  /** Chest circumference in cm. */
  chest: number | null;
  /** Left arm circumference in cm. */
  armLeft: number | null;
  /** Right arm circumference in cm. */
  armRight: number | null;
  /** Thigh circumference in cm. */
  thigh: number | null;
  /** Neck circumference in cm (for Navy BF% formula). */
  neck: number | null;
  /** Height in cm (for Navy BF% formula). */
  height: number | null;
  /** Body-fat % (if estimated/measured). */
  bodyFat: number | null;
}

/** A logged strength lift. */
export interface LiftEntry {
  date: string;
  /** e.g. "Squat", "Bench Press", "Deadlift", "OHP" */
  exercise: string;
  /** Weight in kg. */
  weightKg: number;
  /** Reps performed. */
  reps: number;
  /** Estimated 1-rep-max (Epley formula). */
  oneRepMax: number;
}

/** A personal record for a given exercise. */
export interface LiftPR {
  exercise: string;
  weightKg: number;
  reps: number;
  oneRepMax: number;
  date: string;
}

/** A single cardio / step-count entry. */
export interface CardioEntry {
  date: string;
  steps: number | null;
  /** Duration in minutes. */
  durationMin: number | null;
  /** kcal burned estimate. */
  kcalBurned: number | null;
  /** "run" | "walk" | "cycle" | "swim" | "other" */
  type: string;
}

/** Aggregated streak stats. */
export interface StreakStats {
  /** Current consecutive days with any log (weight OR food). */
  currentStreak: number;
  /** Longest ever streak in the dataset. */
  longestStreak: number;
  /** ISO date of the current streak start. */
  streakStart: string | null;
  /** Total days with any entry in the dataset. */
  totalActiveDays: number;
}

/** Full Progress payload returned by the API. */
export interface ProgressData {
  generatedAt: string;
  /** Most recent measurement (or null). */
  latestMeasurement: Measurement | null;
  /** All measurements oldest→newest. */
  measurements: Measurement[];
  /** Personal records per exercise. */
  prs: LiftPR[];
  /** Recent lift entries (last 30 days), newest first. */
  recentLifts: LiftEntry[];
  /** Recent cardio entries (last 30 days), newest first. */
  recentCardio: CardioEntry[];
  /** Step-count 14-day rolling averages (oldest→newest). */
  stepTrend: { date: string; steps: number }[];
  streaks: StreakStats;
}
