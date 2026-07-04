import type {
  AdherenceSummary,
  DailyCalendarEntry,
  GoalMode,
  Insight,
  InsightsData,
  PlateauStatus,
  Projection,
  WeekSummary,
  WeightPoint,
} from '@nutrition/types';
import {
  computeAdaptiveExpenditure,
  computeWeightTrend,
  KCAL_PER_KG,
  type DailyRecord,
} from './energyModel';
import { estimateEtaWeeks, recommendedCalorieTarget } from './goals';

export interface BuildInsightsOptions {
  mode?: GoalMode;
  targetWeight?: number;
  /** Stamp used for `generatedAt`; injected so the function stays deterministic/testable. */
  now?: string;
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Add N days to an ISO date (YYYY-MM-DD), returning a fresh ISO date. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday-anchored week key for an ISO date. */
function weekStartOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sun
  const delta = dow === 0 ? -6 : 1 - dow; // shift back to Monday
  return addDays(iso, delta);
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Group a history + its trend series into calendar-week summaries. Each week
 * carries average intake (logged days only), the trend weight at week end, the
 * week-over-week rate, and adherence within that week.
 */
function buildWeekSummaries(
  history: DailyRecord[],
  trend: WeightPoint[],
  calorieTarget: number,
): WeekSummary[] {
  const trendByDate = new Map<string, number>(trend.map((p) => [p.date, p.trend]));
  const band = calorieTarget * 0.15;

  const buckets = new Map<string, DailyRecord[]>();
  for (const record of history) {
    const key = weekStartOf(record.date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(record);
    else buckets.set(key, [record]);
  }

  const keys = [...buckets.keys()].sort();
  const summaries: WeekSummary[] = [];
  let prevTrend: number | null = null;

  for (const key of keys) {
    const days = buckets.get(key)!.sort((a, b) => a.date.localeCompare(b.date));
    const weekEnd = days[days.length - 1].date;

    const logged = days.filter((r) => r.intake != null);
    const avgIntake =
      logged.length > 0
        ? Math.round(
            logged.reduce((s, r) => s + (r.intake as number), 0) / logged.length,
          )
        : null;

    const endTrend: number = trendByDate.get(weekEnd) ?? prevTrend ?? 0;
    const weeklyRate = prevTrend == null ? null : round(endTrend - prevTrend, 2);

    const onTarget = logged.filter(
      (r) => Math.abs((r.intake as number) - calorieTarget) <= band,
    ).length;
    const adherence = logged.length > 0 ? round(onTarget / logged.length, 2) : 0;

    summaries.push({
      weekStart: key,
      weekEnd,
      label: `${prettyDate(key)} – ${prettyDate(weekEnd)}`,
      avgIntake,
      avgTrendWeight: round(endTrend, 1),
      weeklyRate,
      adherence,
      daysLogged: logged.length,
    });

    prevTrend = endTrend;
  }

  return summaries;
}

/**
 * Detect a plateau: consecutive most-recent weeks whose |weekly rate| is under
 * ~0.1 kg. Relevant when the user expects movement (fat-loss / lean-bulk).
 */
function detectPlateau(weeks: WeekSummary[], mode: GoalMode): PlateauStatus {
  const FLAT_KG = 0.1;
  const expectsChange = mode === 'fat-loss' || mode === 'lean-bulk';

  let flat = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const rate = weeks[i].weeklyRate;
    if (rate == null) break;
    if (Math.abs(rate) < FLAT_KG) flat++;
    else break;
  }

  const detected = expectsChange && flat >= 3;
  const message = !expectsChange
    ? 'Weight is holding steady — expected for your current goal.'
    : detected
      ? `Trend weight has been flat for ${flat} weeks. Consider a small calorie or activity adjustment.`
      : flat > 0
        ? `Movement has slowed over the last ${flat} week${flat === 1 ? '' : 's'}, but not a plateau yet.`
        : 'Trend weight is moving in line with your goal.';

  return { detected, weeks: flat, message };
}

/** Full-window adherence: logging rate + fraction of logged days on target. */
function buildAdherence(
  history: DailyRecord[],
  calorieTarget: number,
): AdherenceSummary {
  const band = calorieTarget * 0.15;
  const logged = history.filter((r) => r.intake != null);
  const onTarget = logged.filter(
    (r) => Math.abs((r.intake as number) - calorieTarget) <= band,
  ).length;

  const totalDays = history.length;
  const loggingRate = totalDays > 0 ? round(logged.length / totalDays, 2) : 0;
  const overall = logged.length > 0 ? round(onTarget / logged.length, 2) : 0;

  return {
    overall,
    loggingRate,
    onTargetDays: onTarget,
    totalLoggedDays: logged.length,
    totalDays,
  };
}

/** Projection toward the target weight using the recent trend slope. */
function buildProjection(
  trend: WeightPoint[],
  targetWeight: number,
): Projection | null {
  if (trend.length === 0) return null;
  const currentTrend = trend[trend.length - 1].trend;

  const window = trend.slice(-14);
  const days = window.length - 1;
  const weeklyRate =
    days > 0 ? round(((window[window.length - 1].trend - window[0].trend) / days) * 7, 2) : 0;

  const etaWeeks = estimateEtaWeeks(currentTrend, targetWeight, trend);
  const projectedDate =
    etaWeeks != null
      ? addDays(trend[trend.length - 1].date, Math.round(etaWeeks * 7))
      : null;

  return {
    targetWeight,
    currentTrend: round(currentTrend, 1),
    weeklyRate,
    etaWeeks,
    projectedDate,
  };
}

/** Human-readable highlight cards synthesised from the computed metrics. */
function buildHighlights(
  data: Omit<InsightsData, 'highlights'>,
): Insight[] {
  const out: Insight[] = [];
  const { adherence, plateau, projection, expenditure, weeks } = data;

  // Adherence.
  if (adherence.overall >= 0.8) {
    out.push({
      id: 'adherence-strong',
      tone: 'positive',
      title: 'Dialed-in nutrition',
      detail: `You hit your calorie target on ${Math.round(
        adherence.overall * 100,
      )}% of logged days. That consistency is doing the heavy lifting.`,
    });
  } else if (adherence.overall < 0.5) {
    out.push({
      id: 'adherence-weak',
      tone: 'warning',
      title: 'Intake is drifting',
      detail: `Only ${Math.round(
        adherence.overall * 100,
      )}% of logged days landed near your target. Tightening this is the fastest lever you have.`,
    });
  }

  // Logging consistency.
  if (adherence.loggingRate < 0.7) {
    out.push({
      id: 'logging-gaps',
      tone: 'warning',
      title: 'Mind the logging gaps',
      detail: `You logged intake on ${Math.round(
        adherence.loggingRate * 100,
      )}% of days. More complete data sharpens every estimate below.`,
    });
  }

  // Plateau.
  if (plateau.detected) {
    out.push({
      id: 'plateau',
      tone: 'warning',
      title: `${plateau.weeks}-week plateau`,
      detail: plateau.message,
    });
  }

  // Projection.
  if (projection?.etaWeeks != null && projection.etaWeeks > 0) {
    out.push({
      id: 'projection',
      tone: 'positive',
      title: 'On track to your goal',
      detail: `At your current trend you'll reach ${projection.targetWeight} kg in about ${projection.etaWeeks} weeks${
        projection.projectedDate ? ` (~${prettyDate(projection.projectedDate)})` : ''
      }.`,
    });
  }

  // Expenditure movement.
  if (Math.abs(expenditure.trendDelta) >= 0.15) {
    const rising = expenditure.trendDelta < 0; // losing weight faster => burn outpacing intake
    out.push({
      id: 'expenditure-shift',
      tone: 'neutral',
      title: 'Metabolism is adapting',
      detail: `Your learned expenditure sits near ${expenditure.estimate} kcal (confidence ${Math.round(
        expenditure.confidence * 100,
      )}%). ${rising ? 'Recent weeks suggest room to eat a touch more.' : 'Recent weeks suggest a slightly slower burn.'}`,
    });
  }

  // Best week callout.
  const best = [...weeks].filter((w) => w.daysLogged > 0).sort((a, b) => b.adherence - a.adherence)[0];
  if (best && best.adherence >= 0.85) {
    out.push({
      id: 'best-week',
      tone: 'positive',
      title: 'Standout week',
      detail: `${best.label} was your most consistent stretch — ${Math.round(
        best.adherence * 100,
      )}% on-target. Worth repeating.`,
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'keep-going',
      tone: 'neutral',
      title: 'Keep the data coming',
      detail: 'A few more weeks of logging will unlock sharper trends, plateau detection, and timeline projections.',
    });
  }

  return out;
}

/**
 * Compose the full Insights payload from a user's logged history. Pure given
 * its inputs (aside from the optional `now` stamp).
 */
export function buildInsights(
  history: DailyRecord[],
  opts: BuildInsightsOptions = {},
): InsightsData {
  const { mode = 'fat-loss', targetWeight = 78, now } = opts;

  const trendPoints = computeWeightTrend(history);
  const trend: WeightPoint[] = trendPoints.map((p) => ({
    date: p.date,
    scale: p.scale,
    trend: p.trend,
  }));

  const { expenditureEstimate, confidence } = computeAdaptiveExpenditure(history);
  const calorieTarget = recommendedCalorieTarget(expenditureEstimate, mode);

  const weeks = buildWeekSummaries(history, trend, calorieTarget);
  const plateau = detectPlateau(weeks, mode);
  const adherence = buildAdherence(history, calorieTarget);
  const projection = buildProjection(trend, targetWeight);

  // Expenditure trend delta: change in trend weight over the last 7 days (kg).
  const last = trend[trend.length - 1];
  const weekAgo = trend[Math.max(0, trend.length - 8)];
  const trendDelta = last && weekAgo ? round(last.trend - weekAgo.trend, 2) : 0;

  // Per-day calendar for last 90 days
  const band = calorieTarget * 0.15;
  const anchor = now ? now.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const dailyCalendar: DailyCalendarEntry[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(`${anchor}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const rec = history.find((r) => r.date === date);
    const intake = rec?.intake ?? null;
    let status: DailyCalendarEntry['status'] = 'unlogged';
    if (intake != null) {
      if (Math.abs(intake - calorieTarget) <= band) status = 'on-target';
      else if (intake > calorieTarget) status = 'over';
      else status = 'under';
    }
    dailyCalendar.push({ date, intake, target: calorieTarget, status });
  }

  const base: Omit<InsightsData, 'highlights'> = {
    generatedAt: now ?? new Date().toISOString(),
    mode,
    calorieTarget,
    weeks,
    plateau,
    adherence,
    expenditure: {
      estimate: expenditureEstimate,
      confidence,
      trendDelta,
    },
    projection,
    dailyCalendar,
  };

  return { ...base, highlights: buildHighlights(base) };
}

export { KCAL_PER_KG };
