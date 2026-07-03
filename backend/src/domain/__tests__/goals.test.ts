import {
  WEEKLY_RATE_BY_MODE,
  computeGoalProgress,
  estimateEtaWeeks,
  recommendedCalorieTarget,
  type GoalInput,
} from '../goals';
import { KCAL_PER_KG } from '../energyModel';
import type { GoalMode, WeightPoint } from '@nutrition/types';

/** Build a straight-line trend from `from` to `to` over `days` points. */
function linearTrend(from: number, to: number, days: number): WeightPoint[] {
  const step = days > 1 ? (to - from) / (days - 1) : 0;
  return Array.from({ length: days }, (_, i) => ({
    date: `2099-01-${String(i + 1).padStart(2, '0')}`,
    scale: null,
    trend: from + step * i,
  }));
}

describe('recommendedCalorieTarget', () => {
  it('equals expenditure for maintenance', () => {
    expect(recommendedCalorieTarget(2600, 'maintenance')).toBe(2600);
  });

  it('subtracts a deficit for fat loss', () => {
    const expected = Math.round(2600 + (-0.5 * KCAL_PER_KG) / 7);
    expect(recommendedCalorieTarget(2600, 'fat-loss')).toBe(expected);
    expect(recommendedCalorieTarget(2600, 'fat-loss')).toBeLessThan(2600);
  });

  it('adds a surplus for a lean bulk', () => {
    expect(recommendedCalorieTarget(2600, 'lean-bulk')).toBeGreaterThan(2600);
  });

  it('treats recomp like maintenance (zero adjustment)', () => {
    expect(recommendedCalorieTarget(2600, 'recomp')).toBe(2600);
  });
});

describe('computeGoalProgress', () => {
  const base: GoalInput = {
    mode: 'fat-loss',
    startWeight: 90,
    currentWeight: 85,
    targetWeight: 80,
  };

  it('reports fractional progress toward the target', () => {
    const result = computeGoalProgress(base, linearTrend(86, 85, 14));
    // Traveled 5 of a 10kg target delta.
    expect(result.progress).toBe(0.5);
    expect(result.targetWeightDelta).toBe(-10);
    expect(result.mode).toBe('fat-loss');
  });

  it('clamps progress to [0,1] when the user overshoots', () => {
    const result = computeGoalProgress(
      { ...base, currentWeight: 78 },
      linearTrend(80, 78, 14),
    );
    expect(result.progress).toBe(1);
  });

  it('clamps progress to 0 when moving the wrong way', () => {
    const result = computeGoalProgress(
      { ...base, currentWeight: 92 },
      linearTrend(91, 92, 14),
    );
    expect(result.progress).toBe(0);
  });

  it('treats a zero-delta maintenance goal as complete', () => {
    const result = computeGoalProgress(
      { mode: 'maintenance', startWeight: 80, currentWeight: 80, targetWeight: 80 },
      linearTrend(80, 80, 14),
    );
    expect(result.progress).toBe(1);
  });
});

describe('estimateEtaWeeks', () => {
  it('returns 0 when already essentially at target', () => {
    expect(estimateEtaWeeks(80.02, 80, linearTrend(81, 80, 14))).toBe(0);
  });

  it('returns null without enough trend points', () => {
    expect(estimateEtaWeeks(85, 80, [])).toBeNull();
    expect(estimateEtaWeeks(85, 80, linearTrend(85, 85, 1))).toBeNull();
  });

  it('returns null for a flat trend', () => {
    expect(estimateEtaWeeks(85, 80, linearTrend(85, 85, 14))).toBeNull();
  });

  it('returns null when the trend heads away from the target', () => {
    // Need to lose weight but trend is rising.
    expect(estimateEtaWeeks(85, 80, linearTrend(84, 85, 14))).toBeNull();
  });

  it('estimates weeks from the recent slope when heading toward target', () => {
    // Losing 1kg over 13 days ≈ 0.538 kg/week; 5kg remaining ≈ 9.3 weeks.
    const eta = estimateEtaWeeks(85, 80, linearTrend(86, 85, 14));
    expect(eta).not.toBeNull();
    expect(eta!).toBeGreaterThan(8);
    expect(eta!).toBeLessThan(11);
  });
});

describe('WEEKLY_RATE_BY_MODE', () => {
  it('defines a rate for every goal mode', () => {
    const modes: GoalMode[] = ['fat-loss', 'maintenance', 'lean-bulk', 'recomp'];
    for (const mode of modes) {
      expect(typeof WEEKLY_RATE_BY_MODE[mode]).toBe('number');
    }
    expect(WEEKLY_RATE_BY_MODE['fat-loss']).toBeLessThan(0);
    expect(WEEKLY_RATE_BY_MODE['lean-bulk']).toBeGreaterThan(0);
  });
});
