/**
 * Canonical dashboard model shared across backend and frontend.
 *
 * This is the single source of truth for the shape of `GET /api/dashboard`.
 * It intentionally carries both the *daily log* (what the user ate/did today)
 * and the *adaptive metrics* (MacroFactor-style expenditure, trend weight,
 * adherence, goal progress) so the dashboard can render everything from one
 * payload.
 */

/** A single macro/energy target with what's been consumed and what's left. */
export interface MacroTarget {
  /** Daily target set by the coaching engine. */
  target: number;
  /** Amount logged so far today. */
  consumed: number;
  /** target - consumed (may be negative when over). */
  remaining: number;
}

/** The three tracked macronutrients (grams). */
export interface DashboardMacros {
  protein: MacroTarget;
  carbs: MacroTarget;
  fat: MacroTarget;
}

/** One logged meal entry for the day. */
export interface Meal {
  id: number;
  name: string;
  /** kcal */
  calories: number;
  /** grams */
  protein: number;
  /** grams */
  carbs: number;
  /** grams */
  fat: number;
  /** ISO time the meal was logged, e.g. "08:30". Optional for quick-adds. */
  time?: string;
}

/** A single point on the body-weight trend series. */
export interface WeightPoint {
  /** ISO date, e.g. "2026-07-02". */
  date: string;
  /** Raw scale weight in kg (null if the user didn't weigh in). */
  scale: number | null;
  /** Smoothed trend weight in kg (exponential moving average). */
  trend: number;
}

export type GoalMode = 'fat-loss' | 'maintenance' | 'lean-bulk' | 'recomp';

/** A user's persisted goal configuration, set during onboarding. */
export interface UserGoal {
  /** Which trajectory the user is chasing. */
  mode: GoalMode;
  /** Target body weight in kg. */
  targetWeight: number;
  /** Body weight in kg when the goal was set. */
  startWeight: number;
  /** ISO date the goal started, e.g. "2026-07-03". */
  startDate: string;
}

/** Request body to set/update the active goal. */
export interface SetGoalRequest {
  mode: GoalMode;
  targetWeight: number;
  startWeight?: number;
  startDate?: string;
}

/** The adaptive energy model's current read on the user. */
export interface EnergyModel {
  /**
   * Estimated total daily energy expenditure (kcal), learned from logged
   * intake + weight change over a rolling window. NOT a static TDEE formula.
   */
  expenditureEstimate: number;
  /** How confident the model is (0-1), grows as more data accrues. */
  confidence: number;
  /** Trend change in expenditure vs. two weeks ago (kcal, signed). */
  trendDelta: number;
}

/** Progress toward the active goal. */
export interface GoalProgress {
  mode: GoalMode;
  /** kg. Positive = gain goal, negative = loss goal. */
  targetWeightDelta: number;
  /** Fraction of the goal achieved so far (0-1, can exceed 1). */
  progress: number;
  /** Estimated weeks remaining at the current trajectory. */
  etaWeeks: number | null;
}

export interface DashboardData {
  /** ISO date the dashboard represents. */
  date: string;

  /** Energy budget for the day. */
  calories: MacroTarget;
  /** Macro budgets for the day. */
  macros: DashboardMacros;

  /** Meals logged today. */
  meals: Meal[];

  /** Trailing weight series (oldest -> newest), used for the trend chart. */
  weightSeries: WeightPoint[];

  /** Adaptive expenditure model output. */
  energy: EnergyModel;

  /** Weekly adherence score (0-1) — how consistently targets were hit. */
  weeklyAdherence: number;

  /** Active goal + progress. */
  goal: GoalProgress;

  /** Optional free-text note for the day. */
  notes?: string;
}
