import type { ProgressData } from '@nutrition/types';

export function generateProgressData(): ProgressData {
  return {
    generatedAt: new Date().toISOString(),
    latestMeasurement: null,
    measurements: [],
    prs: [],
    recentLifts: [],
    recentCardio: [],
    stepTrend: [],
    streaks: {
      currentStreak: 0,
      longestStreak: 0,
      streakStart: null,
      totalActiveDays: 0,
    },
  };
}
