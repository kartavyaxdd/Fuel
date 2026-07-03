/**
 * Adaptive energy (expenditure) model.
 *
 * Inspired by MacroFactor's approach: rather than assuming a static TDEE from a
 * formula, we *learn* the user's real total daily energy expenditure (TDEE)
 * from the interaction of two observed signals:
 *
 *   1. Logged energy intake (kcal/day).
 *   2. Change in body weight over time.
 *
 * Energy balance says:  intake - expenditure = energy stored/released.
 * Body-weight change is a noisy proxy for stored energy. By smoothing weight
 * into a trend line and comparing the trend's slope against average intake over
 * the same window, we can back out expenditure and continuously re-estimate it.
 *
 * Everything here is a pure function so it can be unit-tested in isolation.
 */

/** kcal released per kg of body-mass change. Blended fat/lean tissue value. */
export const KCAL_PER_KG = 7700;

/** Physiological guardrails so noisy data can't produce absurd estimates. */
export const MIN_EXPENDITURE = 1000;
export const MAX_EXPENDITURE = 6000;

/** How fast a single day's estimate can move the running estimate (0-1). */
export const DEFAULT_ADAPTION_RATE = 0.1;

export interface DailyRecord {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Total energy intake logged that day (kcal). Null if not logged. */
  intake: number | null;
  /** Raw scale weight that day (kg). Null if no weigh-in. */
  weight: number | null;
}

export interface WeightTrendPoint {
  date: string;
  scale: number | null;
  /** Exponentially-smoothed trend weight (kg). */
  trend: number;
}

/**
 * Smooth a raw weight series into a trend line using an exponential moving
 * average. Missing weigh-ins carry the previous trend forward (the trend does
 * not jump on a gap; it simply doesn't update until the next reading).
 *
 * @param records Chronological (oldest -> newest) daily records.
 * @param alpha   Smoothing factor 0-1. Lower = smoother/slower to react.
 */
export function computeWeightTrend(
  records: DailyRecord[],
  alpha = 0.25,
): WeightTrendPoint[] {
  const out: WeightTrendPoint[] = [];
  let trend: number | null = null;

  for (const r of records) {
    if (r.weight != null) {
      trend = trend == null ? r.weight : alpha * r.weight + (1 - alpha) * trend;
    }
    // Until the first weigh-in, fall back to the raw value or 0.
    const effectiveTrend = trend ?? r.weight ?? 0;
    out.push({ date: r.date, scale: r.weight, trend: round(effectiveTrend, 2) });
  }

  return out;
}

/** Average of the defined intake values in a set of records. */
function averageIntake(records: DailyRecord[]): number | null {
  const vals = records.map((r) => r.intake).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Estimate expenditure from a single window of records.
 *
 * expenditure = avgIntake - (weightChangeKg * KCAL_PER_KG) / days
 *
 * i.e. if the trend fell while eating `avgIntake`, expenditure exceeded intake
 * by the released energy per day.
 *
 * Returns null when the window lacks enough signal (no intake, <2 trend points).
 */
export function estimateExpenditureFromWindow(
  records: DailyRecord[],
): number | null {
  if (records.length < 2) return null;

  const avgIntake = averageIntake(records);
  if (avgIntake == null) return null;

  const trend = computeWeightTrend(records);
  const startTrend = trend[0].trend;
  const endTrend = trend[trend.length - 1].trend;
  const days = records.length - 1;
  if (days <= 0) return null;

  const weightChangeKg = endTrend - startTrend;
  const dailyEnergyFromTissue = (weightChangeKg * KCAL_PER_KG) / days;

  const expenditure = avgIntake - dailyEnergyFromTissue;
  return clampExpenditure(expenditure);
}

/**
 * Continuously-updated expenditure estimate.
 *
 * Walks the full history in rolling windows and blends each window's estimate
 * into a running figure with an adaption rate, so recent data nudges the
 * estimate without letting any single noisy day dominate.
 *
 * @param records    Full chronological history.
 * @param windowSize Days per estimation window (default 14).
 * @param adaption   How strongly each window updates the estimate (0-1).
 */
export function computeAdaptiveExpenditure(
  records: DailyRecord[],
  windowSize = 14,
  adaption = DEFAULT_ADAPTION_RATE,
): { expenditureEstimate: number; confidence: number } {
  if (records.length < 2) {
    return { expenditureEstimate: clampExpenditure(2000), confidence: 0 };
  }

  let estimate: number | null = null;
  let windowsUsed = 0;

  for (let end = 1; end < records.length; end++) {
    const start = Math.max(0, end - windowSize + 1);
    const window = records.slice(start, end + 1);
    const windowEstimate = estimateExpenditureFromWindow(window);
    if (windowEstimate == null) continue;

    estimate = estimate == null
      ? windowEstimate
      : adaption * windowEstimate + (1 - adaption) * estimate;
    windowsUsed++;
  }

  if (estimate == null) {
    return { expenditureEstimate: clampExpenditure(2000), confidence: 0 };
  }

  // Confidence grows with how much usable data we've folded in, saturating.
  const confidence = round(Math.min(1, windowsUsed / 21), 2);
  return { expenditureEstimate: clampExpenditure(estimate), confidence };
}

/** Clamp an expenditure value into the physiological range and round. */
export function clampExpenditure(kcal: number): number {
  return Math.round(Math.min(MAX_EXPENDITURE, Math.max(MIN_EXPENDITURE, kcal)));
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
