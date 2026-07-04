import { registerStore, scheduleSave } from './store';

/** Extra kcal added to target on training days. */
export const TRAINING_DAY_BONUS_KCAL = 250;

/** Extra protein grams on training day (pre/post workout). */
export const TRAINING_DAY_BONUS_PROTEIN = 20;

/** Extra carb grams on training day (fuel). */
export const TRAINING_DAY_BONUS_CARBS = 45;

let state = { isTrainingDay: false };

export function isTrainingDay(): boolean {
  return state.isTrainingDay;
}

export function setTrainingDay(value: boolean): boolean {
  state.isTrainingDay = value;
  scheduleSave();
  return state.isTrainingDay;
}

export function toggleTrainingDay(): boolean {
  return setTrainingDay(!state.isTrainingDay);
}

registerStore(
  'trainingDay',
  () => ({ ...state }),
  (data: unknown) => {
    if (data && typeof data === 'object' && 'isTrainingDay' in data) {
      state = { isTrainingDay: Boolean((data as Record<string, unknown>).isTrainingDay) };
    }
  },
);
