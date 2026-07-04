import type { ProgressData, StreakStats } from '@nutrition/types';
import { getMeasurements, getLatestMeasurement, getMeasurementsForUser } from './measurements';
import { getAllLogDates, getAllLogDatesForUser } from './foodLog';
import { getWeightRecords, getWeightRecordsForUser } from './weight';
import { DEMO_ANCHOR_DATE } from './sampleData';

function computeStreaks(anchor: string): StreakStats {
  // Union of all dates with any food or weight entry
  const foodDates = new Set(getAllLogDates());
  const weightDates = new Set(getWeightRecords().map((r) => r.date));
  const allDates = [...new Set([...foodDates, ...weightDates])].sort();

  if (allDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streakStart: null, totalActiveDays: 0 };
  }

  // Build a Set for O(1) lookup
  const dateSet = new Set(allDates);

  // Current streak: consecutive days ending at anchor (or anchor-1)
  let streakStart: string | null = null;
  let currentStreak = 0;
  {
    let cursor = anchor;
    while (dateSet.has(cursor)) {
      currentStreak++;
      streakStart = cursor;
      // go back one day
      const d = new Date(`${cursor}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    }
    // also allow streak ending yesterday (user hasn't logged today yet)
    if (currentStreak === 0) {
      const d = new Date(`${anchor}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
      while (dateSet.has(cursor)) {
        currentStreak++;
        streakStart = cursor;
        const dd = new Date(`${cursor}T00:00:00Z`);
        dd.setUTCDate(dd.getUTCDate() - 1);
        cursor = dd.toISOString().slice(0, 10);
      }
    }
  }

  // Longest streak across all data
  let longest = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const date of allDates) {
    if (prev != null) {
      const prevD = new Date(`${prev}T00:00:00Z`);
      prevD.setUTCDate(prevD.getUTCDate() + 1);
      const isConsecutive = prevD.toISOString().slice(0, 10) === date;
      cur = isConsecutive ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    if (cur > longest) longest = cur;
    prev = date;
  }

  return {
    currentStreak,
    longestStreak: Math.max(longest, currentStreak),
    streakStart: currentStreak > 0 ? streakStart : null,
    totalActiveDays: allDates.length,
  };
}

export function generateProgressData(): ProgressData {
  return {
    generatedAt: new Date().toISOString(),
    latestMeasurement: getLatestMeasurement(),
    measurements: getMeasurements(),
    prs: [],
    recentLifts: [],
    recentCardio: [],
    stepTrend: [],
    streaks: computeStreaks(DEMO_ANCHOR_DATE),
  };
}

export async function buildProgressForUser(userId: string): Promise<ProgressData> {
  const measurements = await getMeasurementsForUser(userId);
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const foodDates = new Set(await getAllLogDatesForUser(userId));
  const weightRecords = await getWeightRecordsForUser(userId);
  const weightDates = new Set(weightRecords.map((r) => r.date));
  const allDates = [...new Set([...foodDates, ...weightDates])].sort();
  const streaks = computeStreaksFromDates(DEMO_ANCHOR_DATE, allDates);
  return {
    generatedAt: new Date().toISOString(),
    latestMeasurement: latest,
    measurements,
    prs: [],
    recentLifts: [],
    recentCardio: [],
    stepTrend: [],
    streaks,
  };
}

function computeStreaksFromDates(anchor: string, allDates: string[]): StreakStats {
  if (allDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streakStart: null, totalActiveDays: 0 };
  }
  const dateSet = new Set(allDates);
  let streakStart: string | null = null;
  let currentStreak = 0;
  {
    let cursor = anchor;
    while (dateSet.has(cursor)) {
      currentStreak++;
      streakStart = cursor;
      const d = new Date(`${cursor}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    }
    if (currentStreak === 0) {
      const d = new Date(`${anchor}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
      while (dateSet.has(cursor)) {
        currentStreak++;
        streakStart = cursor;
        const dd = new Date(`${cursor}T00:00:00Z`);
        dd.setUTCDate(dd.getUTCDate() - 1);
        cursor = dd.toISOString().slice(0, 10);
      }
    }
  }
  let longest = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const date of allDates) {
    if (prev != null) {
      const prevD = new Date(`${prev}T00:00:00Z`);
      prevD.setUTCDate(prevD.getUTCDate() + 1);
      const isConsecutive = prevD.toISOString().slice(0, 10) === date;
      cur = isConsecutive ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    if (cur > longest) longest = cur;
    prev = date;
  }
  return {
    currentStreak,
    longestStreak: Math.max(longest, currentStreak),
    streakStart: currentStreak > 0 ? streakStart : null,
    totalActiveDays: allDates.length,
  };
}
