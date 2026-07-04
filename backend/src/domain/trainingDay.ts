import { registerStore, scheduleSave, select, upsert } from './store';

/** Extra kcal added to target on training days. */
export const TRAINING_DAY_BONUS_KCAL = 250;

/** Extra protein grams on training day (pre/post workout). */
export const TRAINING_DAY_BONUS_PROTEIN = 20;

/** Extra carb grams on training day (fuel). */
export const TRAINING_DAY_BONUS_CARBS = 45;

/** Persisted state: date -> boolean (is training day). */
let state: Record<string, boolean> = {};

export function isTrainingDay(date?: string): boolean {
  const d = date ?? new Date().toISOString().slice(0, 10);
  return state[d] === true;
}

export function setTrainingDay(date: string, value: boolean): boolean {
  state[date] = value;
  if (!value) delete state[date];
  scheduleSave();
  return value;
}

export function toggleTrainingDay(date?: string): boolean {
  const d = date ?? new Date().toISOString().slice(0, 10);
  return setTrainingDay(d, !isTrainingDay(d));
}

registerStore(
  'trainingDay',
  () => ({ ...state }),
  (data: unknown) => {
    if (data && typeof data === 'object') {
      state = { ...data } as Record<string, boolean>;
    }
  },
);

export async function isTrainingDayForUser(date: string, userId: string): Promise<boolean> {
  const raw = await select('trainingDay', userId) as Record<string, boolean> | null;
  const s = raw ?? {};
  return s[date] === true;
}

export async function setTrainingDayForUser(date: string, value: boolean, userId: string): Promise<boolean> {
  const raw = await select('trainingDay', userId) as Record<string, boolean> | null;
  const s = raw ?? {};
  s[date] = value;
  if (!value) delete s[date];
  await upsert('trainingDay', s, userId);
  return value;
}
