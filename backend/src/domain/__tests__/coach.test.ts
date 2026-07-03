import { buildCoach } from '../coach';
import type { DailyRecord } from '../energyModel';

/** Build a contiguous daily history starting at `start` (ISO). */
function makeHistory(
  start: string,
  days: number,
  fn: (i: number) => { intake: number | null; weight: number | null },
): DailyRecord[] {
  const out: DailyRecord[] = [];
  const base = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), ...fn(i) });
  }
  return out;
}

const NOW = '2026-07-03T00:00:00.000Z';

describe('buildCoach — determinism & shape', () => {
  const history = makeHistory('2026-04-06', 84, (i) => ({
    intake: 2100,
    weight: 90 - i * 0.05,
  }));

  it('is deterministic given a fixed `now`', () => {
    const a = buildCoach(history, { now: NOW });
    const b = buildCoach(history, { now: NOW });
    expect(a).toEqual(b);
    expect(a.generatedAt).toBe(NOW);
  });

  it('returns every top-level section', () => {
    const data = buildCoach(history, { now: NOW });
    expect(data.mode).toBe('fat-loss');
    expect(typeof data.headline).toBe('string');
    expect(typeof data.summary).toBe('string');
    expect(typeof data.focus).toBe('string');
    expect(data.confidence).toBeGreaterThanOrEqual(0);
    expect(data.confidence).toBeLessThanOrEqual(1);
    expect(data.checkIn).toBeDefined();
    expect(data.targets).toBeDefined();
    expect(data.recommendations.length).toBeGreaterThan(0);
    expect(data.talkingPoints.length).toBeGreaterThan(0);
    expect(data.talkingPoints.length).toBeLessThanOrEqual(4);
  });
});

describe('targets & macros', () => {
  const history = makeHistory('2026-04-06', 84, () => ({ intake: 2100, weight: 85 }));

  it('computes delta as recommended - current', () => {
    const { targets } = buildCoach(history, { now: NOW, currentTarget: 1800 });
    expect(targets.current).toBe(1800);
    expect(targets.delta).toBe(targets.recommended - 1800);
  });

  it('defaults current to recommended (zero drift) when unset', () => {
    const { targets } = buildCoach(history, { now: NOW });
    expect(targets.current).toBe(targets.recommended);
    expect(targets.delta).toBe(0);
  });

  it('anchors protein higher for fat-loss than maintenance', () => {
    const fatLoss = buildCoach(history, { now: NOW, mode: 'fat-loss' });
    const maint = buildCoach(history, { now: NOW, mode: 'maintenance' });
    expect(fatLoss.targets.protein).toBeGreaterThan(maint.targets.protein);
  });

  it('keeps all macro grams non-negative', () => {
    const { targets } = buildCoach(history, { now: NOW });
    expect(targets.protein).toBeGreaterThanOrEqual(0);
    expect(targets.carbs).toBeGreaterThanOrEqual(0);
    expect(targets.fat).toBeGreaterThanOrEqual(0);
  });
});

describe('recommendations', () => {
  it('are sorted by ascending priority', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2100, weight: 85 }));
    const { recommendations } = buildCoach(history, { now: NOW });
    const priorities = recommendations.map((r) => r.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  it('always includes the protein anchor card', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2100, weight: 85 }));
    const { recommendations } = buildCoach(history, { now: NOW });
    expect(recommendations.some((r) => r.id === 'protein-anchor')).toBe(true);
  });

  it('surfaces a target-adjust card when current drifts far from recommended', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2100, weight: 85 }));
    const { recommendations, targets } = buildCoach(history, {
      now: NOW,
      currentTarget: 1000, // force a large delta
    });
    expect(Math.abs(targets.delta)).toBeGreaterThanOrEqual(40);
    const adjust = recommendations.find((r) => r.id === 'target-adjust');
    expect(adjust).toBeDefined();
    expect(adjust!.priority).toBe(1);
  });

  it('flags a plateau card on a flat fat-loss trend', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2100, weight: 85 }));
    const { recommendations } = buildCoach(history, { now: NOW, mode: 'fat-loss' });
    expect(recommendations.some((r) => r.id === 'plateau-break')).toBe(true);
  });

  it('does not flag a plateau card in maintenance mode', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2100, weight: 85 }));
    const { recommendations } = buildCoach(history, { now: NOW, mode: 'maintenance' });
    expect(recommendations.some((r) => r.id === 'plateau-break')).toBe(false);
  });

  it('warns on poor adherence and rewards strong adherence', () => {
    // Wild swings well outside any target band -> low adherence.
    const messy = makeHistory('2026-04-06', 84, (i) => ({
      intake: i % 2 === 0 ? 900 : 3600,
      weight: 85,
    }));
    const warned = buildCoach(messy, { now: NOW });
    expect(warned.recommendations.some((r) => r.id === 'tighten-adherence')).toBe(true);
    expect(warned.recommendations.some((r) => r.id === 'reward-adherence')).toBe(false);
  });
});

describe('check-in', () => {
  it('reads null energy balance when nothing is logged', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: null, weight: 85 }));
    const { checkIn } = buildCoach(history, { now: NOW });
    expect(checkIn.avgIntake).toBeNull();
    expect(checkIn.energyBalance).toBeNull();
    expect(checkIn.verdict).toContain('Not enough logged intake');
  });

  it('computes energy balance as avgIntake - avgExpenditure', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2100, weight: 85 }));
    const { checkIn } = buildCoach(history, { now: NOW });
    expect(checkIn.avgIntake).not.toBeNull();
    expect(checkIn.energyBalance).toBe(
      Math.round((checkIn.avgIntake as number) - checkIn.avgExpenditure),
    );
  });
});
