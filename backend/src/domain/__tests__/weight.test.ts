import { normalizeRange, logWeight, buildWeightData } from '../weight';
import { WEIGHT_RANGES, type WeightRange } from '@nutrition/types';

// Seed some deterministic test data before each test suite
beforeAll(() => {
  const startDate = '2026-04-04';
  for (let i = 0; i < 90; i++) {
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    // Simulate a gentle downward trend from 84 to 78 kg with noise
    const weight = 84 - (i / 90) * 6 + (Math.random() - 0.5) * 0.6;
    logWeight({ date, weight: parseFloat(weight.toFixed(1)) });
  }
});

describe('normalizeRange', () => {
  it('passes through every valid range', () => {
    for (const range of WEIGHT_RANGES) {
      expect(normalizeRange(range)).toBe(range);
    }
  });

  it('coerces numeric strings', () => {
    expect(normalizeRange('60')).toBe(60);
    expect(normalizeRange('180')).toBe(180);
  });

  it('falls back to 90 for anything invalid', () => {
    expect(normalizeRange(45)).toBe(90);
    expect(normalizeRange('banana')).toBe(90);
    expect(normalizeRange(undefined)).toBe(90);
    expect(normalizeRange(null)).toBe(90);
    expect(normalizeRange({})).toBe(90);
  });
});

describe('buildWeightData', () => {
  it('returns a series no longer than the requested range', () => {
    for (const range of WEIGHT_RANGES) {
      const data = buildWeightData(range);
      expect(data.range).toBe(range);
      expect(data.unit).toBe('kg');
      expect(data.series.length).toBeLessThanOrEqual(range);
    }
  });

  it('warms the EMA on full history so shorter ranges still end at the same trend', () => {
    const short = buildWeightData(30);
    const long = buildWeightData(180);
    const shortLast = short.series[short.series.length - 1];
    const longLast = long.series[long.series.length - 1];
    expect(shortLast.trend).toBe(longLast.trend);
    expect(short.stats.currentTrend).toBe(long.stats.currentTrend);
  });

  it('derives stats that agree with the returned series', () => {
    const data = buildWeightData(90);
    const trends = data.series.map((p) => p.trend);
    expect(data.stats.lowestTrend).toBe(Math.min(...trends));
    expect(data.stats.highestTrend).toBe(Math.max(...trends));
    expect(data.stats.currentTrend).toBe(trends[trends.length - 1]);
    expect(data.stats.windowDays).toBe(90);
    const scaleCount = data.series.filter((p) => p.scale != null).length;
    expect(data.stats.entriesLogged).toBe(scaleCount);
  });

  it('reflects a fresh weigh-in as the latest scale reading', () => {
    const range: WeightRange = 30;
    const before = buildWeightData(range);
    const latestDate = before.date;
    logWeight({ date: latestDate, weight: 77.7 });
    const after = buildWeightData(range);
    const lastPoint = after.series[after.series.length - 1];
    expect(lastPoint.date).toBe(latestDate);
    expect(lastPoint.scale).toBe(77.7);
    expect(after.stats.latestScale).toBe(77.7);
  });
});
