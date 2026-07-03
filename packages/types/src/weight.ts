/**
 * Weight-tracking model shared across backend and frontend.
 *
 * Single source of truth for the shape of the `/api/weight` endpoints. The
 * page renders the raw scale series alongside a smoothed trend line, plus the
 * headline stats (current trend, weekly rate of change, total change) that turn
 * a noisy scale into an honest read on direction.
 */

import type { WeightPoint } from './dashboard';

export type { WeightPoint };

/** A range selector for the trend chart, in days. */
export type WeightRange = 30 | 60 | 90 | 180;

/** The selectable ranges, in display order. */
export const WEIGHT_RANGES: WeightRange[] = [30, 60, 90, 180];

/** Headline summary stats derived from the trend series. */
export interface WeightStats {
  /** Latest smoothed trend weight (kg). */
  currentTrend: number;
  /** Most recent raw scale weight (kg), null if never weighed in. */
  latestScale: number | null;
  /** Change in trend weight over the last 7 days (kg, signed). */
  weeklyRate: number;
  /** Change in trend weight across the whole window (kg, signed). */
  totalChange: number;
  /** Lowest trend weight in the window (kg). */
  lowestTrend: number;
  /** Highest trend weight in the window (kg). */
  highestTrend: number;
  /** Number of days with an actual weigh-in in the window. */
  entriesLogged: number;
  /** Days in the window. */
  windowDays: number;
}

/** Full payload for the weight page. */
export interface WeightData {
  /** ISO date the payload represents (newest point). */
  date: string;
  /** Selected window length in days. */
  range: WeightRange;
  /** Trend series for the selected window (oldest -> newest). */
  series: WeightPoint[];
  /** Derived headline stats for the window. */
  stats: WeightStats;
  /** Preferred unit for display. Weights are always stored in kg. */
  unit: 'kg' | 'lb';
}

/** Body for POST /api/weight — record or overwrite a day's weigh-in. */
export interface LogWeightRequest {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Scale weight in kg. */
  weight: number;
}
