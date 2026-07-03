import { KCAL_PER_KG } from './energyModel';
import type { GoalMode, GoalProgress, WeightPoint } from '@nutrition/types';

/**
 * Recommended weekly rate of body-weight change (kg/week) per goal mode.
 * Negative = loss. These are conservative, sustainable defaults.
 */
export const WEEKLY_RATE_BY_MODE: Record<GoalMode, number> = {
  'fat-loss': -0.5,
  maintenance: 0,
  'lean-bulk': 0.2,
  recomp: 0,
};

export interface GoalInput {
  mode: GoalMode;
  startWeight: number;
  currentWeight: number;
  targetWeight: number;
}

/**
 * Given a goal and the observed weight trend, compute how far along the user is
 * and estimate weeks-to-goal from their *actual* recent trend slope.
 */
export function computeGoalProgress(
  input: GoalInput,
  trend: WeightPoint[],
): GoalProgress {
  const { mode, startWeight, currentWeight, targetWeight } = input;
  const targetWeightDelta = round(targetWeight - startWeight, 2);
  const traveled = currentWeight - startWeight;

  const progress = targetWeightDelta === 0
    ? (mode === 'maintenance' || mode === 'recomp' ? 1 : 0)
    : clamp01(traveled / targetWeightDelta);

  return {
    mode,
    targetWeightDelta,
    progress: round(progress, 3),
    etaWeeks: estimateEtaWeeks(currentWeight, targetWeight, trend),
  };
}

/**
 * Estimate weeks until target using the slope of the trend line over the last
 * ~2 weeks. Returns null if the trend is flat or moving the wrong way.
 */
export function estimateEtaWeeks(
  currentWeight: number,
  targetWeight: number,
  trend: WeightPoint[],
): number | null {
  const remaining = targetWeight - currentWeight;
  if (Math.abs(remaining) < 0.05) return 0;
  if (trend.length < 2) return null;

  const window = trend.slice(-14);
  const first = window[0].trend;
  const last = window[window.length - 1].trend;
  const days = window.length - 1;
  if (days <= 0) return null;

  const kgPerDay = (last - first) / days;
  const kgPerWeek = kgPerDay * 7;
  if (Math.abs(kgPerWeek) < 1e-4) return null;

  // Trend must be heading toward the target.
  if (Math.sign(kgPerWeek) !== Math.sign(remaining)) return null;

  return round(Math.abs(remaining / kgPerWeek), 1);
}

/**
 * Derive a daily calorie target from learned expenditure and the goal's
 * intended weekly rate of weight change.
 */
export function recommendedCalorieTarget(
  expenditure: number,
  mode: GoalMode,
): number {
  const kgPerWeek = WEEKLY_RATE_BY_MODE[mode];
  const dailyAdjustment = (kgPerWeek * KCAL_PER_KG) / 7;
  return Math.round(expenditure + dailyAdjustment);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
