import { generateProgressData } from '../progress';

const data = generateProgressData();

describe('generateProgressData — shape', () => {
  it('returns every top-level section', () => {
    expect(data.measurements).toEqual([]);
    expect(data.prs).toEqual([]);
    expect(data.recentLifts).toEqual([]);
    expect(data.stepTrend).toEqual([]);
    expect(data.streaks).toBeDefined();
    expect(typeof data.generatedAt).toBe('string');
  });

  it('latestMeasurement is null when empty', () => {
    expect(data.latestMeasurement).toBeNull();
  });

  it('caps recent slices', () => {
    expect(data.recentLifts.length).toBeLessThanOrEqual(30);
    expect(data.recentCardio.length).toBeLessThanOrEqual(20);
  });
});

describe('streaks', () => {
  it('all streaks are zero when no data', () => {
    expect(data.streaks.currentStreak).toBe(0);
    expect(data.streaks.longestStreak).toBe(0);
    expect(data.streaks.streakStart).toBeNull();
    expect(data.streaks.totalActiveDays).toBe(0);
  });
});
