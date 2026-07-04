import type { GoalMode } from './dashboard';

/** A single calendar-aligned week of aggregated history. */
export interface WeekSummary {
  /** ISO date of the first day in the week (oldest). */
  weekStart: string;
  /** ISO date of the last day in the week (newest). */
  weekEnd: string;
  /** Human label, e.g. "Jul 1 – Jul 7". */
  label: string;
  /** Mean logged intake across days with a log (kcal). Null if none logged. */
  avgIntake: number | null;
  /** Mean trend weight across the week (kg). */
  avgTrendWeight: number;
  /** Change in trend weight from the previous week (kg). Null for first week. */
  weeklyRate: number | null;
  /** Fraction of days (0-1) whose intake landed within the target band. */
  adherence: number;
  /** Number of days in the week with a logged intake. */
  daysLogged: number;
}

/** Whether the trend has stalled relative to the goal's intended direction. */
export interface PlateauStatus {
  detected: boolean;
  /** How many recent weeks the trend has been effectively flat. */
  weeks: number;
  message: string;
}

/** Consistency of logging and hitting targets across the whole window. */
export interface AdherenceSummary {
  /** Fraction of logged days within +/-15% of target. */
  overall: number;
  /** Fraction of all days that had any intake logged. */
  loggingRate: number;
  onTargetDays: number;
  totalLoggedDays: number;
  totalDays: number;
}

/** Forward projection toward the goal weight from the current trend slope. */
export interface Projection {
  targetWeight: number;
  currentTrend: number;
  /** Recent weekly rate of trend change (kg/week). */
  weeklyRate: number;
  /** Estimated weeks to reach target, or null if not converging. */
  etaWeeks: number | null;
  /** ISO date of the projected arrival, or null. */
  projectedDate: string | null;
}

export type InsightTone = 'positive' | 'neutral' | 'warning';

/** A single surfaced, human-readable observation. */
export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
}

/** A single day's calorie adherence status. */
export interface DailyCalendarEntry {
  date: string;
  /** kcal logged, or null if unlogged */
  intake: number | null;
  /** recommended target for that day */
  target: number;
  /** 'on-target' = within 15%, 'over' = >15% above, 'under' = >15% below, 'unlogged' */
  status: 'on-target' | 'over' | 'under' | 'unlogged';
}

/** Full Insights payload. */
export interface InsightsData {
  generatedAt: string;
  mode: GoalMode;
  calorieTarget: number;
  weeks: WeekSummary[];
  plateau: PlateauStatus;
  adherence: AdherenceSummary;
  expenditure: {
    estimate: number;
    confidence: number;
    trendDelta: number;
  };
  projection: Projection | null;
  highlights: Insight[];
  /** Per-day calorie adherence for the last 90 days (oldest→newest) */
  dailyCalendar: DailyCalendarEntry[];
}
