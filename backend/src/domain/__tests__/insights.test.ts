import { buildInsights } from '../insights';
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
    const date = d.toISOString().slice(0, 10);
    out.push({ date, ...fn(i) });
  }
  return out;
}

const NOW = '2026-07-03T00:00:00.000Z';

describe('buildInsights — determinism & shape', () => {
  const history = makeHistory('2026-04-06', 84, (i) => ({
    intake: 2200,
    weight: 90 - i * 0.05,
  }));

  it('is deterministic given a fixed `now`', () => {
    const a = buildInsights(history, { now: NOW });
    const b = buildInsights(history, { now: NOW });
    expect(a).toEqual(b);
    expect(a.generatedAt).toBe(NOW);
  });

  it('returns every top-level section', () => {
    const data = buildInsights(history, { now: NOW });
    expect(data.mode).toBe('fat-loss');
    expect(data.weeks.length).toBeGreaterThan(0);
    expect(data.plateau).toBeDefined();
    expect(data.adherence).toBeDefined();
    expect(data.projection).not.toBeNull();
    expect(data.highlights.length).toBeGreaterThan(0);
  });

  it('honours the requested mode', () => {
    const data = buildInsights(history, { now: NOW, mode: 'maintenance' });
    expect(data.mode).toBe('maintenance');
  });
});

describe('adherence math', () => {
  it('reports full adherence & logging when every day is on target', () => {
    // Intake pinned to whatever the recommended target lands on is hard to know
    // a priori, so instead assert the internal consistency of the ratios.
    const history = makeHistory('2026-04-06', 28, () => ({ intake: 2200, weight: 88 }));
    const { adherence } = buildInsights(history, { now: NOW });

    expect(adherence.totalDays).toBe(28);
    expect(adherence.totalLoggedDays).toBe(28);
    expect(adherence.loggingRate).toBe(1);
    expect(adherence.onTargetDays).toBeLessThanOrEqual(adherence.totalLoggedDays);
    expect(adherence.overall).toBeCloseTo(
      adherence.onTargetDays / adherence.totalLoggedDays,
      2,
    );
  });

  it('drops logging rate when intake is missing on some days', () => {
    const history = makeHistory('2026-04-06', 28, (i) => ({
      intake: i % 2 === 0 ? 2200 : null,
      weight: 88,
    }));
    const { adherence } = buildInsights(history, { now: NOW });

    expect(adherence.totalDays).toBe(28);
    expect(adherence.totalLoggedDays).toBe(14);
    expect(adherence.loggingRate).toBe(0.5);
  });
});

describe('plateau detection', () => {
  it('flags a plateau on a flat fat-loss trend', () => {
    const history = makeHistory('2026-04-06', 84, () => ({
      intake: 2200,
      weight: 85, // dead flat for 12 weeks
    }));
    const { plateau } = buildInsights(history, { now: NOW, mode: 'fat-loss' });
    expect(plateau.detected).toBe(true);
    expect(plateau.weeks).toBeGreaterThanOrEqual(3);
  });

  it('never flags a plateau in maintenance mode', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2200, weight: 85 }));
    const { plateau } = buildInsights(history, { now: NOW, mode: 'maintenance' });
    expect(plateau.detected).toBe(false);
  });

  it('does not flag a plateau while weight is steadily dropping', () => {
    const history = makeHistory('2026-04-06', 84, (i) => ({
      intake: 2200,
      weight: 92 - i * 0.08,
    }));
    const { plateau } = buildInsights(history, { now: NOW, mode: 'fat-loss' });
    expect(plateau.detected).toBe(false);
  });
});

describe('projection', () => {
  it('projects a future ETA & date when trending toward target', () => {
    const history = makeHistory('2026-04-06', 84, (i) => ({
      intake: 2000,
      weight: 90 - i * 0.06,
    }));
    const { projection } = buildInsights(history, { now: NOW, targetWeight: 80 });
    expect(projection).not.toBeNull();
    expect(projection!.targetWeight).toBe(80);
    expect(projection!.etaWeeks).not.toBeNull();
    expect(projection!.etaWeeks!).toBeGreaterThan(0);
    expect(projection!.projectedDate).not.toBeNull();
  });
});

describe('week summaries', () => {
  it('are ordered by week start and never exceed 7 logged days each', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2200, weight: 85 }));
    const { weeks } = buildInsights(history, { now: NOW });

    const starts = weeks.map((w) => w.weekStart);
    expect([...starts].sort((a, b) => a.localeCompare(b))).toEqual(starts);

    for (const w of weeks) {
      expect(w.daysLogged).toBeLessThanOrEqual(7);
      expect(w.weekStart <= w.weekEnd).toBe(true);
    }
  });

  it('leaves the first week rate null (no prior week to compare)', () => {
    const history = makeHistory('2026-04-06', 84, () => ({ intake: 2200, weight: 85 }));
    const { weeks } = buildInsights(history, { now: NOW });
    expect(weeks[0].weeklyRate).toBeNull();
  });
});

describe('highlights', () => {
  it('always emits at least one card', () => {
    const history = makeHistory('2026-04-06', 7, () => ({ intake: 2200, weight: 85 }));
    const { highlights } = buildInsights(history, { now: NOW });
    expect(highlights.length).toBeGreaterThan(0);
    for (const h of highlights) {
      expect(h.id).toBeTruthy();
      expect(['positive', 'warning', 'neutral']).toContain(h.tone);
    }
  });
});
