import type { DailyRecord } from './energyModel';
import { getDailyIntakes } from './foodLog';
import { getWeightRecords } from './weight';

/**
 * Build the canonical DailyRecord[] from the user's real stores.
 * The food log supplies daily intake (kcal), the weight store supplies
 * scale weight (kg).  Dates present in only one store get null for the
 * missing field.  Returns an empty array for a brand-new user.
 */
export function buildDailyRecords(): DailyRecord[] {
  const intakeByDate = getDailyIntakes();
  const weightByDate = new Map(
    getWeightRecords().map(r => [r.date, r.weight!]),
  );

  const allDates = new Set<string>([
    ...intakeByDate.keys(),
    ...weightByDate.keys(),
  ]);

  return [...allDates].sort().map(date => ({
    date,
    intake: intakeByDate.get(date) ?? null,
    weight: weightByDate.get(date) ?? null,
  }));
}
