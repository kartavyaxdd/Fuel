import type {
  CoachCheckIn,
  CoachData,
  CoachRecommendation,
  CoachTargets,
  GoalMode,
  WeightPoint,
} from '@nutrition/types';
import {
  computeAdaptiveExpenditure,
  computeWeightTrend,
  KCAL_PER_KG,
  type DailyRecord,
} from './energyModel';
import {
  estimateEtaWeeks,
  recommendedCalorieTarget,
  WEEKLY_RATE_BY_MODE,
} from './goals';
import { generateSampleHistory } from './sampleData';

export interface BuildCoachOptions {
  mode?: GoalMode;
  targetWeight?: number;
  /** The calorie target the user is presumed to currently run. Defaults to the
   * engine's recommendation for the mode (i.e. no drift). */
  currentTarget?: number;
  /** Stamp used for `generatedAt`; injected to keep the function deterministic. */
  now?: string;
}

/** Protein grams per kg of body weight, tuned per goal. */
const PROTEIN_PER_KG: Record<GoalMode, number> = {
  'fat-loss': 2.2,
  maintenance: 1.8,
  'lean-bulk': 2.0,
  recomp: 2.2,
};

/** Fraction of remaining (non-protein) calories allocated to fat, per goal. */
const FAT_FRACTION: Record<GoalMode, number> = {
  'fat-loss': 0.35,
  maintenance: 0.3,
  'lean-bulk': 0.25,
  recomp: 0.3,
};

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function averageIntake(records: DailyRecord[]): number | null {
  const vals = records
    .map((r) => r.intake)
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Derive recommended macros from a calorie target and the user's trend weight.
 * Protein is anchored to body weight, fat to a share of the remainder, carbs
 * fill the rest.
 */
function buildMacros(
  calories: number,
  bodyWeightKg: number,
  mode: GoalMode,
): { protein: number; carbs: number; fat: number } {
  const protein = Math.round(bodyWeightKg * PROTEIN_PER_KG[mode]);
  const proteinKcal = protein * 4;
  const remaining = Math.max(0, calories - proteinKcal);
  const fatKcal = remaining * FAT_FRACTION[mode];
  const fat = Math.max(0, Math.round(fatKcal / 9));
  const carbs = Math.max(0, Math.round((remaining - fatKcal) / 4));
  return { protein, carbs, fat };
}

/**
 * Retrospective read on the most recent `windowDays` of history: what was
 * eaten, what the body actually burned, how weight trended, and how tightly the
 * user held their target.
 */
function buildCheckIn(
  history: DailyRecord[],
  trend: WeightPoint[],
  calorieTarget: number,
  avgExpenditure: number,
  windowDays: number,
): CoachCheckIn {
  const window = history.slice(-windowDays);
  const first = window[0];
  const last = window[window.length - 1];
  const periodLabel =
    first && last
      ? `${prettyDate(first.date)} – ${prettyDate(last.date)}`
      : 'Recent window';

  const avgIntake = averageIntake(window);
  const energyBalance =
    avgIntake != null ? Math.round(avgIntake - avgExpenditure) : null;

  const trendWindow = trend.slice(-windowDays);
  const weightTrendDelta =
    trendWindow.length >= 2
      ? round(
          trendWindow[trendWindow.length - 1].trend - trendWindow[0].trend,
          2,
        )
      : 0;

  const band = calorieTarget * 0.15;
  const logged = window.filter((r) => r.intake != null);
  const onTarget = logged.filter(
    (r) => Math.abs((r.intake as number) - calorieTarget) <= band,
  ).length;
  const adherence = logged.length > 0 ? round(onTarget / logged.length, 2) : 0;

  const dirWord =
    weightTrendDelta < -0.05
      ? 'down'
      : weightTrendDelta > 0.05
        ? 'up'
        : 'flat';
  const balanceWord =
    energyBalance == null
      ? 'unlogged'
      : energyBalance < -100
        ? 'in a deficit'
        : energyBalance > 100
          ? 'in a surplus'
          : 'at maintenance';

  const verdict =
    energyBalance == null
      ? 'Not enough logged intake this window to read your energy balance — log a few more days to sharpen the picture.'
      : `Trend weight moved ${dirWord === 'flat' ? 'flat' : `${Math.abs(weightTrendDelta)} kg ${dirWord}`} while you ran ${balanceWord} (~${
          energyBalance > 0 ? '+' : ''
        }${energyBalance} kcal/day). Adherence held at ${Math.round(
          adherence * 100,
        )}%.`;

  return {
    periodLabel,
    avgIntake: avgIntake != null ? Math.round(avgIntake) : null,
    avgExpenditure: Math.round(avgExpenditure),
    energyBalance,
    weightTrendDelta,
    adherence,
    verdict,
  };
}

/** Count trailing weeks (7-day chunks) where |trend delta| stayed under 0.1 kg. */
function trailingFlatWeeks(trend: WeightPoint[]): number {
  if (trend.length < 8) return 0;
  let flat = 0;
  for (let end = trend.length - 1; end - 7 >= 0; end -= 7) {
    const delta = Math.abs(trend[end].trend - trend[end - 7].trend);
    if (delta < 0.1) flat++;
    else break;
  }
  return flat;
}

/**
 * Synthesize a prioritized set of grounded recommendations from the computed
 * state. Each card ties its advice to the user's own numbers.
 */
function buildRecommendations(args: {
  mode: GoalMode;
  checkIn: CoachCheckIn;
  targets: CoachTargets;
  flatWeeks: number;
  loggingRate: number;
  confidence: number;
}): CoachRecommendation[] {
  const { mode, checkIn, targets, flatWeeks, loggingRate, confidence } = args;
  const out: CoachRecommendation[] = [];
  const expectsChange = mode === 'fat-loss' || mode === 'lean-bulk';

  // 1. Calorie target adjustment — the headline lever.
  if (Math.abs(targets.delta) >= 40) {
    const raise = targets.delta > 0;
    out.push({
      id: 'target-adjust',
      tone: 'action',
      category: 'calories',
      title: raise ? 'Nudge calories up' : 'Trim calories back',
      rationale: `Your learned expenditure puts the right target near ${targets.recommended} kcal — ${Math.abs(
        targets.delta,
      )} kcal ${raise ? 'above' : 'below'} where you've been running.`,
      action: `Set your daily target to ${targets.recommended} kcal and hold it for two weeks before reassessing.`,
      delta: {
        label: 'Daily target',
        value: targets.delta,
        unit: 'kcal',
      },
      priority: 1,
    });
  }

  // 2. Plateau troubleshooting.
  if (expectsChange && flatWeeks >= 3) {
    const cut = mode === 'fat-loss';
    out.push({
      id: 'plateau-break',
      tone: 'warning',
      category: 'calories',
      title: `Break the ${flatWeeks}-week plateau`,
      rationale: `Trend weight has been flat for ${flatWeeks} weeks while your goal expects movement. Your body has likely adapted to the current intake.`,
      action: cut
        ? 'Drop intake ~150 kcal/day or add ~2k daily steps, then watch the trend for 10–14 days.'
        : 'Add ~150 kcal/day of quality carbs around training, then reassess in 10–14 days.',
      delta: {
        label: 'Suggested shift',
        value: cut ? -150 : 150,
        unit: 'kcal',
      },
      priority: 2,
    });
  }

  // 3. Protein anchor.
  out.push({
    id: 'protein-anchor',
    tone: 'neutral',
    category: 'macros',
    title: 'Hold your protein floor',
    rationale: `At your goal, ${targets.protein} g protein/day protects lean mass and keeps you full — the highest-leverage macro to hit first.`,
    action: `Aim for ${targets.protein} g daily; spread it across 3–4 meals of ~${Math.round(
      targets.protein / 3.5,
    )} g.`,
    delta: { label: 'Protein', value: targets.protein, unit: 'g' },
    priority: 3,
  });

  // 4. Adherence / consistency.
  if (checkIn.adherence < 0.6) {
    out.push({
      id: 'tighten-adherence',
      tone: 'warning',
      category: 'adherence',
      title: 'Tighten the target band',
      rationale: `Only ${Math.round(
        checkIn.adherence * 100,
      )}% of recent logged days landed near target. Consistency beats precision — the swings are muddying your trend.`,
      action: 'Pre-plan tomorrow the night before so the target is a decision you make once, not all day.',
      priority: 4,
    });
  } else if (checkIn.adherence >= 0.85) {
    out.push({
      id: 'reward-adherence',
      tone: 'positive',
      category: 'adherence',
      title: 'Consistency is paying off',
      rationale: `You held target on ${Math.round(
        checkIn.adherence * 100,
      )}% of logged days. That's the engine behind every trend below — keep it steady.`,
      action: 'Change nothing here. Protect the routine that got you this number.',
      priority: 6,
    });
  }

  // 5. Logging completeness (sharpens the model itself).
  if (loggingRate < 0.7 || confidence < 0.5) {
    out.push({
      id: 'log-more',
      tone: 'neutral',
      category: 'adherence',
      title: 'Feed the model more data',
      rationale: `Model confidence sits at ${Math.round(
        confidence * 100,
      )}%. A few more consecutive logged days tightens every estimate the coach makes.`,
      action: 'Log intake and a morning weigh-in daily for the next week — even rough estimates help.',
      priority: 5,
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}

/**
 * Compose the full Coach payload from a user's logged history. Pure given its
 * inputs (aside from the optional `now` stamp).
 */
export function buildCoach(
  history: DailyRecord[],
  opts: BuildCoachOptions = {},
): CoachData {
  const { mode = 'fat-loss', targetWeight = 78, currentTarget, now } = opts;

  const trendPoints = computeWeightTrend(history);
  const trend: WeightPoint[] = trendPoints.map((p) => ({
    date: p.date,
    scale: p.scale,
    trend: p.trend,
  }));

  const { expenditureEstimate, confidence } =
    computeAdaptiveExpenditure(history);
  const recommended = recommendedCalorieTarget(expenditureEstimate, mode);
  const current = currentTarget ?? recommended;

  const currentWeight =
    trend.length > 0 ? trend[trend.length - 1].trend : targetWeight;
  const macros = buildMacros(recommended, currentWeight, mode);

  const targets: CoachTargets = {
    current,
    recommended,
    delta: recommended - current,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    rationale: `Built from a learned expenditure of ${expenditureEstimate} kcal and your ${mode.replace(
      '-',
      ' ',
    )} goal (${WEEKLY_RATE_BY_MODE[mode] > 0 ? '+' : ''}${
      WEEKLY_RATE_BY_MODE[mode]
    } kg/week).`,
  };

  const checkIn = buildCheckIn(
    history,
    trend,
    recommended,
    expenditureEstimate,
    14,
  );

  const flatWeeks = trailingFlatWeeks(trend);
  const logged = history.filter((r) => r.intake != null).length;
  const loggingRate = history.length > 0 ? logged / history.length : 0;

  const recommendations = buildRecommendations({
    mode,
    checkIn,
    targets,
    flatWeeks,
    loggingRate,
    confidence,
  });

  const eta = estimateEtaWeeks(currentWeight, targetWeight, trend);
  const focus =
    recommendations[0]?.title ?? 'Stay the course';

  const headline = buildHeadline(mode, checkIn, targets);
  const summary = buildSummary(mode, checkIn, targets, eta, targetWeight);

  return {
    generatedAt: now ?? new Date().toISOString(),
    mode,
    headline,
    summary,
    focus,
    confidence,
    checkIn,
    targets,
    recommendations,
    talkingPoints: buildTalkingPoints(mode, checkIn, targets, flatWeeks),
  };
}

function buildHeadline(
  mode: GoalMode,
  checkIn: CoachCheckIn,
  targets: CoachTargets,
): string {
  if (Math.abs(targets.delta) >= 40) {
    return targets.delta > 0
      ? 'You have room to eat more.'
      : "Let's tighten the target.";
  }
  if (checkIn.adherence >= 0.85) return "You're dialed in — keep it rolling.";
  if (checkIn.adherence < 0.6) return 'Consistency is the next win.';
  return 'Steady progress — small tweaks ahead.';
}

function buildSummary(
  mode: GoalMode,
  checkIn: CoachCheckIn,
  targets: CoachTargets,
  eta: number | null,
  targetWeight: number,
): string {
  const parts: string[] = [];
  parts.push(checkIn.verdict);
  if (Math.abs(targets.delta) >= 40) {
    parts.push(
      `The model now recommends ${targets.recommended} kcal/day (${
        targets.delta > 0 ? '+' : ''
      }${targets.delta} vs current).`,
    );
  } else {
    parts.push(`Your current target of ${targets.current} kcal still fits.`);
  }
  if (eta != null && eta > 0) {
    parts.push(`At this trend you'd reach ${targetWeight} kg in ~${eta} weeks.`);
  }
  return parts.join(' ');
}

function buildTalkingPoints(
  mode: GoalMode,
  checkIn: CoachCheckIn,
  targets: CoachTargets,
  flatWeeks: number,
): string[] {
  const points: string[] = [];
  if (checkIn.energyBalance == null) {
    points.push('What got in the way of logging intake this window?');
  } else {
    points.push(
      `Did the ${
        checkIn.energyBalance < 0 ? 'deficit' : 'surplus'
      } feel sustainable, or were you fighting hunger/fatigue?`,
    );
  }
  if (flatWeeks >= 2) {
    points.push('Has your daily activity (steps, training) quietly dropped off?');
  }
  points.push('Is your sleep supporting recovery and appetite control this week?');
  points.push(
    `Can you plan your ${targets.protein} g protein into meals before the day starts?`,
  );
  return points.slice(0, 4);
}

/** Convenience: build coach output from generated demo history. */
export function buildDemoCoach(): CoachData {
  return buildCoach(generateSampleHistory(), {
    mode: 'fat-loss',
    targetWeight: 78,
  });
}

export { KCAL_PER_KG };
