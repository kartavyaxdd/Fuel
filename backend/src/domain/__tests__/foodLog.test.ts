import {
  logFood,
  deleteLoggedFood,
  buildFoodDay,
  copyDay,
  seedDemoDay,
} from '../foodLog';

// The domain module holds an in-memory LOG keyed by date. Each test uses a
// unique date so state cannot leak between cases within a single run.

describe('logFood', () => {
  it('creates a scaled entry and appends it to the day', () => {
    const date = '2099-01-01';
    const entry = logFood(date, 'lunch', 'db-chicken-breast', 2, '2099-01-01T12:00:00.000Z');

    expect(entry.id).toMatch(/^log-\d+$/);
    expect(entry.name).toBe('Chicken breast, grilled');
    expect(entry.slot).toBe('lunch');
    expect(entry.quantity).toBe(2);
    // 165 kcal / 31g protein per serving, scaled ×2.
    expect(entry.calories).toBe(330);
    expect(entry.protein).toBe(62);

    const day = buildFoodDay(date);
    const lunch = day.groups.find((g) => g.slot === 'lunch');
    expect(lunch?.entries).toHaveLength(1);
    expect(lunch?.entries[0].id).toBe(entry.id);
  });

  it('rounds macros and calories sensibly for fractional quantities', () => {
    const date = '2099-01-02';
    const entry = logFood(date, 'snack', 'db-banana', 1.5, '2099-01-02T15:00:00.000Z');
    // 105 kcal ×1.5 = 157.5 → 158; protein 1.3 ×1.5 = 1.95 → 2.0 (one decimal).
    expect(entry.calories).toBe(158);
    expect(entry.protein).toBe(2);
  });

  it('throws for an unknown food id', () => {
    expect(() =>
      logFood('2099-01-03', 'breakfast', 'db-nope', 1, '2099-01-03T08:00:00.000Z'),
    ).toThrow('Unknown food: db-nope');
  });
});

describe('deleteLoggedFood', () => {
  it('removes an existing entry and returns true', () => {
    const date = '2099-02-01';
    const entry = logFood(date, 'breakfast', 'db-oats', 1, '2099-02-01T08:00:00.000Z');
    expect(deleteLoggedFood(date, entry.id)).toBe(true);

    const day = buildFoodDay(date);
    const breakfast = day.groups.find((g) => g.slot === 'breakfast');
    expect(breakfast?.entries ?? []).toHaveLength(0);
  });

  it('returns false when the day has no entries', () => {
    expect(deleteLoggedFood('2099-02-02', 'log-999')).toBe(false);
  });

  it('returns false when the entry id is not on the day', () => {
    const date = '2099-02-03';
    logFood(date, 'breakfast', 'db-oats', 1, '2099-02-03T08:00:00.000Z');
    expect(deleteLoggedFood(date, 'log-does-not-exist')).toBe(false);
  });
});

describe('buildFoodDay', () => {
  it('rolls up consumed totals and computes remaining against the target', () => {
    const date = '2099-03-01';
    logFood(date, 'lunch', 'db-chicken-breast', 2, '2099-03-01T12:00:00.000Z'); // 330 kcal
    logFood(date, 'lunch', 'db-white-rice', 2, '2099-03-01T12:05:00.000Z'); // 260 kcal

    const day = buildFoodDay(date);
    expect(day.date).toBe(date);
    expect(day.consumed.calories).toBe(590);
    expect(day.remaining.calories).toBe(day.target.calories - day.consumed.calories);
  });

  it('returns an empty-but-shaped day when nothing is logged', () => {
    const day = buildFoodDay('2099-03-02');
    expect(day.consumed.calories).toBe(0);
    expect(day.remaining.calories).toBe(day.target.calories);
    // Every meal slot is still represented.
    expect(day.groups.length).toBeGreaterThan(0);
  });

  it('sorts entries within a slot by logged time', () => {
    const date = '2099-03-03';
    logFood(date, 'snack', 'db-banana', 1, '2099-03-03T18:00:00.000Z');
    logFood(date, 'snack', 'db-almonds', 1, '2099-03-03T09:00:00.000Z');

    const snacks = buildFoodDay(date).groups.find((g) => g.slot === 'snack');
    expect(snacks?.entries[0].name).toBe('Almonds');
  });
});

describe('copyDay', () => {
  it('re-logs every entry onto the target day and returns the count', () => {
    const from = '2099-04-01';
    const to = '2099-04-02';
    logFood(from, 'breakfast', 'db-oats', 1, '2099-04-01T08:00:00.000Z');
    logFood(from, 'lunch', 'db-chicken-breast', 2, '2099-04-01T12:00:00.000Z');

    const count = copyDay(from, to, '2099-04-02T08:00:00.000Z');
    expect(count).toBe(2);

    const source = buildFoodDay(from);
    const target = buildFoodDay(to);
    expect(target.consumed.calories).toBe(source.consumed.calories);
  });

  it('returns 0 when the source day is empty', () => {
    expect(copyDay('2099-04-03', '2099-04-04', '2099-04-04T08:00:00.000Z')).toBe(0);
  });
});

describe('seedDemoDay', () => {
  it('populates a day with demo entries', () => {
    const date = '2099-05-01';
    seedDemoDay(date);
    const day = buildFoodDay(date);
    expect(day.consumed.calories).toBeGreaterThan(0);
    expect(day.groups.some((g) => g.entries.length > 0)).toBe(true);
  });

  it('is idempotent — seeding twice does not double the day', () => {
    const date = '2099-05-02';
    seedDemoDay(date);
    const first = buildFoodDay(date).consumed.calories;
    seedDemoDay(date);
    const second = buildFoodDay(date).consumed.calories;
    expect(second).toBe(first);
  });
});
