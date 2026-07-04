import type {
  DashboardData,
  GoalMode,
  MacroTarget,
  Meal,
  WeightPoint,
} from '@nutrition/types';
import {
  computeAdaptiveExpenditure,
  computeWeightTrend,
  type DailyRecord,
} from './energyModel';
import { computeGoalProgress, recommendedCalorieTarget } from './goals';
import { getGoal } from './userGoal';
import { getDayMeals } from './foodLog';
import { buildDailyRecords, buildDailyRecordsForUser } from './dailyRecords';
import { DEMO_ANCHOR_DATE } from './sampleData';
import { isTrainingDay } from './trainingDay';
import { getGoalForUser } from './userGoal';

/** Macro split (fraction of calories) targeted per gram type. */
const PROTEIN_KCAL_PER_G = 4;
const CARB_KCAL_PER_G = 4;
const FAT_KCAL_PER_G = 9;

function macroTarget(target: number, consumed: number): MacroTarget {
  return {
    target: Math.round(target),
    consumed: Math.round(consumed),
    remaining: Math.round(target - consumed),
  };
}

/** Today's meals pulled from the real food log (empty after reset). */
function todaysMeals(): Meal[] {
  return getDayMeals(DEMO_ANCHOR_DATE).map((e, i) => ({
    id: i + 1,
    name: e.name,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    time: e.time,
  }));
}

export interface BuildDashboardOptions {
  mode?: GoalMode;
  targetWeight?: number;
}

/**
 * Compose the full dashboard payload from a user's logged history using the
 * adaptive energy model and goal projections. Pure given its inputs.
 */
export function buildDashboard(
  history: DailyRecord[],
  opts: BuildDashboardOptions = {},
): DashboardData {
  const { mode = 'fat-loss', targetWeight = 78 } = opts;

  const trendPoints = computeWeightTrend(history);
  const weightSeries: WeightPoint[] = trendPoints.map((p) => ({
    date: p.date,
    scale: p.scale,
    trend: p.trend,
  }));

  const { expenditureEstimate, confidence } = computeAdaptiveExpenditure(history);

  // Trend delta: change in trend weight over the last 7 days (kg).
  const last = weightSeries[weightSeries.length - 1];
  const weekAgo = weightSeries[Math.max(0, weightSeries.length - 8)];
  const trendDelta = last && weekAgo ? round(last.trend - weekAgo.trend, 2) : 0;

  const calorieTarget = recommendedCalorieTarget(expenditureEstimate, mode, isTrainingDay(DEMO_ANCHOR_DATE));

  // Today's consumed values from the actual food log.
  const meals = todaysMeals();
  const consumedCals = meals.reduce((s, m) => s + m.calories, 0);
  const consumedProtein = meals.reduce((s, m) => s + m.protein, 0);
  const consumedCarbs = meals.reduce((s, m) => s + m.carbs, 0);
  const consumedFat = meals.reduce((s, m) => s + m.fat, 0);

  // Macro targets: 30% protein / 40% carbs / 30% fat of the calorie target.
  const proteinTarget = (calorieTarget * 0.3) / PROTEIN_KCAL_PER_G;
  const carbTarget = (calorieTarget * 0.4) / CARB_KCAL_PER_G;
  const fatTarget = (calorieTarget * 0.3) / FAT_KCAL_PER_G;

  const startWeight = firstDefinedTrend(weightSeries);
  const currentWeight = last ? last.trend : targetWeight;
  const goal = computeGoalProgress(
    { mode, startWeight, currentWeight, targetWeight },
    weightSeries,
  );

  return {
    date: last?.date ?? new Date().toISOString().slice(0, 10),
    calories: macroTarget(calorieTarget, consumedCals),
    macros: {
      protein: macroTarget(proteinTarget, consumedProtein),
      carbs: macroTarget(carbTarget, consumedCarbs),
      fat: macroTarget(fatTarget, consumedFat),
    },
    meals,
    weightSeries,
    energy: {
      expenditureEstimate,
      confidence,
      trendDelta,
    },
    weeklyAdherence: computeWeeklyAdherence(history, calorieTarget),
    goal,
  };
}

/** Convenience: build the dashboard from the user's real data. */
export function buildDemoDashboard(): DashboardData {
  const goal = getGoal();
  return buildDashboard(buildDailyRecords(), {
    mode: goal.mode,
    targetWeight: goal.targetWeight,
  });
}



/**
 * Adherence = fraction of the last 7 logged days whose intake landed within
 * +/- 15% of the calorie target. A simple, honest consistency signal.
 */
function computeWeeklyAdherence(
  history: DailyRecord[],
  calorieTarget: number,
): number {
  const week = history.slice(-7).filter((r) => r.intake != null);
  if (week.length === 0) return 0;
  const band = calorieTarget * 0.15;
  const onTarget = week.filter(
    (r) => Math.abs((r.intake as number) - calorieTarget) <= band,
  ).length;
  return round(onTarget / week.length, 2);
}

function firstDefinedTrend(series: WeightPoint[]): number {
  return series.length > 0 ? series[0].trend : 0;
}

export async function buildDashboardForUser(userId: string): Promise<DashboardData> {
  const goal = await getGoalForUser(userId);
  const records = await buildDailyRecordsForUser(userId);
  return buildDashboard(records, { mode: goal.mode, targetWeight: goal.targetWeight });
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
