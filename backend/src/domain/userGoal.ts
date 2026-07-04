import type { GoalMode, SetGoalRequest, UserGoal } from '@nutrition/types';
import { registerStore, scheduleSave } from './store';

/**
 * The single active user goal. Defaults mirror the previous hardcoded
 * dashboard assumption (fat-loss toward 78kg) so the app is coherent before
 * the user completes onboarding. A real app keys this by user id.
 */
const DEFAULT_GOAL: UserGoal = {
  mode: 'fat-loss',
  targetWeight: 78,
  startWeight: 84,
  startDate: '2026-07-03',
};

let GOAL: UserGoal = { ...DEFAULT_GOAL };

const VALID_MODES: GoalMode[] = ['fat-loss', 'maintenance', 'lean-bulk', 'recomp'];

function isValidMode(value: unknown): value is GoalMode {
  return typeof value === 'string' && (VALID_MODES as string[]).includes(value);
}

/** Reset goal to default (fat-loss to 78kg). */
export function resetGoal(): UserGoal {
  GOAL = { ...DEFAULT_GOAL };
  scheduleSave();
  return getGoal();
}

/** Read the active goal. */
export function getGoal(): UserGoal {
  return { ...GOAL };
}

/**
 * Set (overwrite) the active goal. Validates mode and target weight; fills
 * startWeight/startDate with sensible fallbacks when omitted.
 */
export function setGoal(req: SetGoalRequest): UserGoal {
  if (!isValidMode(req.mode)) {
    throw new Error(`Invalid goal mode: ${String(req.mode)}`);
  }
  const targetWeight = Number(req.targetWeight);
  if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
    throw new Error(`Invalid target weight: ${String(req.targetWeight)}`);
  }

  const startWeight =
    req.startWeight != null && Number.isFinite(Number(req.startWeight))
      ? Number(req.startWeight)
      : GOAL.startWeight;

  const startDate =
    typeof req.startDate === 'string' && req.startDate.length > 0
      ? req.startDate
      : GOAL.startDate;

  GOAL = {
    mode: req.mode,
    targetWeight,
    startWeight,
    startDate,
    ...(req.targetBodyFat != null ? { targetBodyFat: Number(req.targetBodyFat) } : {}),
    ...(req.height != null ? { height: Number(req.height) } : {}),
    ...(req.sex != null ? { sex: req.sex } : {}),
  };
  scheduleSave();
  return getGoal();
}

/** Persist the active goal. */
registerStore(
  'goal',
  (): UserGoal => ({ ...GOAL }),
  (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const d = data as Partial<UserGoal>;
    if (!isValidMode(d.mode)) return;
    if (typeof d.targetWeight !== 'number') return;
    GOAL = {
      mode: d.mode,
      targetWeight: d.targetWeight,
      startWeight:
        typeof d.startWeight === 'number' ? d.startWeight : DEFAULT_GOAL.startWeight,
      startDate:
        typeof d.startDate === 'string' ? d.startDate : DEFAULT_GOAL.startDate,
      ...(typeof d.targetBodyFat === 'number' ? { targetBodyFat: d.targetBodyFat } : {}),
      ...(typeof d.height === 'number' ? { height: d.height } : {}),
      ...(typeof d.sex === 'string' ? { sex: d.sex as 'male' | 'female' } : {}),
    };
  },
);
