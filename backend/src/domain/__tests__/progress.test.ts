import { generateProgressData } from '../progress';

// The generator is driven by a module-seeded PRNG, so its structure is stable
// within a run. We assert on invariants that must hold for ANY valid dataset
// rather than exact random values.
const data = generateProgressData();

describe('generateProgressData — shape', () => {
  it('returns every top-level section', () => {
    expect(data.measurements.length).toBeGreaterThan(0);
    expect(data.prs.length).toBeGreaterThan(0);
    expect(data.recentLifts.length).toBeGreaterThan(0);
    expect(data.stepTrend.length).toBe(14);
    expect(data.streaks).toBeDefined();
    expect(typeof data.generatedAt).toBe('string');
  });

  it('exposes the most recent measurement as latestMeasurement', () => {
    const last = data.measurements[data.measurements.length - 1];
    expect(data.latestMeasurement).toEqual(last);
  });

  it('caps recent slices', () => {
    expect(data.recentLifts.length).toBeLessThanOrEqual(30);
    expect(data.recentCardio.length).toBeLessThanOrEqual(20);
  });
});

describe('measurements', () => {
  it('are sorted ascending by date', () => {
    const dates = data.measurements.map((m) => m.date);
    expect([...dates].sort((a, b) => a.localeCompare(b))).toEqual(dates);
  });
});

describe('personal records', () => {
  it('holds exactly one PR per exercise', () => {
    const exercises = data.prs.map((p) => p.exercise);
    expect(new Set(exercises).size).toBe(exercises.length);
  });

  it('is sorted by estimated 1RM descending', () => {
    const oneRms = data.prs.map((p) => p.oneRepMax);
    expect([...oneRms].sort((a, b) => b - a)).toEqual(oneRms);
  });

  it('each PR is the best 1RM among that exercise’s logged lifts', () => {
    for (const pr of data.prs) {
      const forExercise = data.recentLifts.filter((l) => l.exercise === pr.exercise);
      for (const lift of forExercise) {
        expect(pr.oneRepMax).toBeGreaterThanOrEqual(lift.oneRepMax);
      }
    }
  });
});

describe('lifts', () => {
  it('are sorted most-recent first', () => {
    const dates = data.recentLifts.map((l) => l.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it('carry a positive estimated one-rep max', () => {
    for (const lift of data.recentLifts) {
      expect(lift.oneRepMax).toBeGreaterThan(0);
      expect(lift.reps).toBeGreaterThan(0);
      // Epley: 1RM must be at least the working weight.
      expect(lift.oneRepMax).toBeGreaterThanOrEqual(lift.weightKg);
    }
  });
});

describe('streaks', () => {
  it('never reports a current streak longer than the longest', () => {
    expect(data.streaks.currentStreak).toBeLessThanOrEqual(data.streaks.longestStreak);
  });

  it('counts total active days as a non-negative integer', () => {
    expect(data.streaks.totalActiveDays).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(data.streaks.totalActiveDays)).toBe(true);
  });

  it('names a streak start date whenever a current streak is live', () => {
    if (data.streaks.currentStreak > 0) {
      expect(data.streaks.streakStart).not.toBeNull();
    }
  });
});
