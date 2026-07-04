import type { DailyRecord } from './energyModel';
import { getDailyIntakes, getFoodLogForUser } from './foodLog';
import { getWeightRecords, getWeightRecordsForUser } from './weight';

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

export async function buildDailyRecordsForUser(userId: string): Promise<DailyRecord[]> {
  const log = await getFoodLogForUser(userId);
  const intakeByDate = new Map<string, number>();
  for (const [date, entries] of log) {
    intakeByDate.set(date, entries.reduce((s, e) => s + e.calories, 0));
  }
  const weightByDate = new Map(
    (await getWeightRecordsForUser(userId)).map(r => [r.date, r.weight!]),
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
