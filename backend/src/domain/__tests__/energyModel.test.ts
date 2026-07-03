import {
  computeWeightTrend,
  estimateExpenditureFromWindow,
  computeAdaptiveExpenditure,
  clampExpenditure,
  MIN_EXPENDITURE,
  MAX_EXPENDITURE,
  KCAL_PER_KG,
  type DailyRecord,
} from '../energyModel';

/** Build a synthetic history: constant intake, linear weight change. */
function synth(
  days: number,
  intake: number,
  startWeight: number,
  kgPerDay: number,
): DailyRecord[] {
  const out: DailyRecord[] = [];
  for (let i = 0; i < days; i++) {
    const d = String(i + 1).padStart(2, '0');
    out.push({
      date: `2026-01-${d}`,
      intake,
      weight: round(startWeight + kgPerDay * i, 3),
    });
  }
  return out;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

describe('computeWeightTrend', () => {
  it('returns one point per record', () => {
    const trend = computeWeightTrend(synth(10, 2000, 80, 0));
    expect(trend).toHaveLength(10);
  });

  it('tracks a stable weight to the same trend value', () => {
    const trend = computeWeightTrend(synth(20, 2000, 80, 0));
    expect(trend[trend.length - 1].trend).toBeCloseTo(80, 1);
  });

  it('carries the trend forward across missing weigh-ins', () => {
    const records: DailyRecord[] = [
      { date: '2026-01-01', intake: 2000, weight: 80 },
      { date: '2026-01-02', intake: 2000, weight: null },
      { date: '2026-01-03', intake: 2000, weight: null },
    ];
    const trend = computeWeightTrend(records);
    expect(trend[1].trend).toBe(80);
    expect(trend[2].trend).toBe(80);
    expect(trend[1].scale).toBeNull();
  });

  it('lags the raw value (smoothing) on a step change', () => {
    const records: DailyRecord[] = [
      { date: '2026-01-01', intake: 2000, weight: 80 },
      { date: '2026-01-02', intake: 2000, weight: 82 },
    ];
    const trend = computeWeightTrend(records, 0.25);
    // 0.25*82 + 0.75*80 = 80.5, not 82
    expect(trend[1].trend).toBeCloseTo(80.5, 2);
  });
});

describe('estimateExpenditureFromWindow', () => {
  it('equals intake when weight is perfectly stable', () => {
    const est = estimateExpenditureFromWindow(synth(14, 2500, 80, 0));
    expect(est).toBeCloseTo(2500, -1);
  });

  it('exceeds intake when weight is falling', () => {
    // Losing 0.1 kg/day on 2000 kcal => burning ~770 extra/day.
    const est = estimateExpenditureFromWindow(synth(14, 2000, 80, -0.1));
    expect(est).toBeGreaterThan(2000);
  });

  it('is below intake when weight is rising', () => {
    const est = estimateExpenditureFromWindow(synth(14, 3000, 80, 0.1));
    expect(est).toBeLessThan(3000);
  });

  it('returns null without enough data', () => {
    expect(estimateExpenditureFromWindow([])).toBeNull();
    expect(
      estimateExpenditureFromWindow([{ date: '2026-01-01', intake: 2000, weight: 80 }]),
    ).toBeNull();
  });

  it('returns null when no intake is logged', () => {
    const records: DailyRecord[] = [
      { date: '2026-01-01', intake: null, weight: 80 },
      { date: '2026-01-02', intake: null, weight: 79.9 },
    ];
    expect(estimateExpenditureFromWindow(records)).toBeNull();
  });
});

describe('computeAdaptiveExpenditure', () => {
  it('converges near true expenditure for a consistent deficit', () => {
    // True expenditure ~2770: eat 2000, lose 0.1kg/day (770 kcal/day).
    const { expenditureEstimate, confidence } = computeAdaptiveExpenditure(
      synth(60, 2000, 90, -0.1),
    );
    expect(expenditureEstimate).toBeGreaterThan(2500);
    expect(expenditureEstimate).toBeLessThan(3000);
    expect(confidence).toBeGreaterThan(0.5);
  });

  it('reports zero confidence with too little data', () => {
    const { confidence } = computeAdaptiveExpenditure([
      { date: '2026-01-01', intake: 2000, weight: 80 },
    ]);
    expect(confidence).toBe(0);
  });
});

describe('clampExpenditure', () => {
  it('enforces the physiological floor and ceiling', () => {
    expect(clampExpenditure(-500)).toBe(MIN_EXPENDITURE);
    expect(clampExpenditure(99999)).toBe(MAX_EXPENDITURE);
    expect(clampExpenditure(2500)).toBe(2500);
  });
});

describe('constants', () => {
  it('uses a sane kcal-per-kg value', () => {
    expect(KCAL_PER_KG).toBeGreaterThan(7000);
    expect(KCAL_PER_KG).toBeLessThan(8000);
  });
});
