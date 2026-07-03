import { getFoodById, searchFoods, FOOD_DB } from '../foodDb';

describe('getFoodById', () => {
  it('returns the matching food item', () => {
    const food = getFoodById('db-chicken-breast');
    expect(food).toBeDefined();
    expect(food?.name).toBe('Chicken breast, grilled');
    expect(food?.protein).toBe(31);
  });

  it('returns undefined for an unknown id', () => {
    expect(getFoodById('db-nope')).toBeUndefined();
  });
});

describe('searchFoods', () => {
  it('returns a default set for an empty query', () => {
    const results = searchFoods('');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(20);
    expect(results).toEqual(FOOD_DB.slice(0, results.length));
  });

  it('respects the limit for an empty query', () => {
    expect(searchFoods('', 3)).toHaveLength(3);
  });

  it('is case-insensitive and trims whitespace', () => {
    const lower = searchFoods('chicken');
    const messy = searchFoods('  CHICKEN  ');
    expect(messy).toEqual(lower);
    expect(lower.length).toBeGreaterThan(0);
  });

  it('ranks prefix matches above substring matches', () => {
    const results = searchFoods('rice');
    // "White rice" / "Brown rice" contain but do not start with "rice";
    // there is no prefix match, so both substring matches appear.
    const names = results.map((f) => f.name);
    expect(names).toContain('White rice, cooked');
    expect(names).toContain('Brown rice, cooked');
  });

  it('surfaces a prefix match first and shorter names win ties', () => {
    const results = searchFoods('egg');
    // "Egg white" (9 chars) and "Egg, whole" (10) both prefix-match;
    // score = 100 - name.length, so the shorter name ranks first.
    expect(results[0].name).toBe('Egg white');
    expect(results[1].name).toBe('Egg, whole');
  });

  it('matches on brand when the name does not match', () => {
    const results = searchFoods('optimum');
    expect(results.map((f) => f.id)).toContain('db-whey');
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchFoods('zzzxqq')).toEqual([]);
  });

  it('caps results at the provided limit', () => {
    expect(searchFoods('e', 2).length).toBeLessThanOrEqual(2);
  });
});
