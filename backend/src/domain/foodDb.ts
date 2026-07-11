import type { FoodItem } from '@nutrition/types';

/**
 * A curated seed food database. Macros are per one serving (servingSize +
 * servingUnit). This stands in for a real nutrition DB / barcode API; it's
 * intentionally broad enough to make search feel alive in the demo.
 */
export const FOOD_DB: FoodItem[] = [
  { id: 'db-egg', name: 'Egg, whole', source: 'database', servingSize: 1, servingUnit: 'large', calories: 72, protein: 6, carbs: 0.4, fat: 5, barcode: '0001' },
  { id: 'db-egg-white', name: 'Egg white', source: 'database', servingSize: 1, servingUnit: 'large', calories: 17, protein: 3.6, carbs: 0.2, fat: 0.1 },
  { id: 'db-greek-yogurt', name: 'Greek yogurt, nonfat', brand: 'Fage', source: 'database', servingSize: 170, servingUnit: 'g', calories: 100, protein: 18, carbs: 6, fat: 0 },
  { id: 'db-oats', name: 'Rolled oats', source: 'database', servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 3 },
  { id: 'db-banana', name: 'Banana', source: 'database', servingSize: 1, servingUnit: 'medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, barcode: '0002' },
  { id: 'db-blueberries', name: 'Blueberries', source: 'database', servingSize: 100, servingUnit: 'g', calories: 57, protein: 0.7, carbs: 14, fat: 0.3 },
  { id: 'db-chicken-breast', name: 'Chicken breast, grilled', source: 'database', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'db-salmon', name: 'Salmon, baked', source: 'database', servingSize: 100, servingUnit: 'g', calories: 208, protein: 20, carbs: 0, fat: 13 },
  { id: 'db-ground-beef', name: 'Ground beef, 90/10', source: 'database', servingSize: 100, servingUnit: 'g', calories: 176, protein: 20, carbs: 0, fat: 10 },
  { id: 'db-white-rice', name: 'White rice, cooked', source: 'database', servingSize: 100, servingUnit: 'g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'db-brown-rice', name: 'Brown rice, cooked', source: 'database', servingSize: 100, servingUnit: 'g', calories: 123, protein: 2.7, carbs: 26, fat: 1 },
  { id: 'db-sweet-potato', name: 'Sweet potato, baked', source: 'database', servingSize: 100, servingUnit: 'g', calories: 90, protein: 2, carbs: 21, fat: 0.1 },
  { id: 'db-broccoli', name: 'Broccoli, steamed', source: 'database', servingSize: 100, servingUnit: 'g', calories: 35, protein: 2.4, carbs: 7, fat: 0.4 },
  { id: 'db-avocado', name: 'Avocado', source: 'database', servingSize: 100, servingUnit: 'g', calories: 160, protein: 2, carbs: 9, fat: 15 },
  { id: 'db-olive-oil', name: 'Olive oil', source: 'database', servingSize: 1, servingUnit: 'tbsp', calories: 119, protein: 0, carbs: 0, fat: 14 },
  { id: 'db-almonds', name: 'Almonds', source: 'database', servingSize: 28, servingUnit: 'g', calories: 164, protein: 6, carbs: 6, fat: 14 },
  { id: 'db-peanut-butter', name: 'Peanut butter', source: 'database', servingSize: 32, servingUnit: 'g', calories: 190, protein: 8, carbs: 7, fat: 16 },
  { id: 'db-whey', name: 'Whey protein', brand: 'Optimum Nutrition', source: 'database', servingSize: 1, servingUnit: 'scoop', calories: 120, protein: 24, carbs: 3, fat: 1, barcode: '0003' },
  { id: 'db-whole-milk', name: 'Whole milk', source: 'database', servingSize: 240, servingUnit: 'ml', calories: 149, protein: 8, carbs: 12, fat: 8 },
  { id: 'db-cheddar', name: 'Cheddar cheese', source: 'database', servingSize: 28, servingUnit: 'g', calories: 113, protein: 7, carbs: 0.4, fat: 9 },
  { id: 'db-whole-wheat-bread', name: 'Whole wheat bread', source: 'database', servingSize: 1, servingUnit: 'slice', calories: 80, protein: 4, carbs: 14, fat: 1 },
  { id: 'db-pasta', name: 'Pasta, cooked', source: 'database', servingSize: 100, servingUnit: 'g', calories: 158, protein: 6, carbs: 31, fat: 0.9 },
  { id: 'db-black-beans', name: 'Black beans', source: 'database', servingSize: 100, servingUnit: 'g', calories: 132, protein: 9, carbs: 24, fat: 0.5 },
  { id: 'db-apple', name: 'Apple', source: 'database', servingSize: 1, servingUnit: 'medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { id: 'db-spinach', name: 'Spinach, raw', source: 'database', servingSize: 100, servingUnit: 'g', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { id: 'db-tuna', name: 'Tuna, canned in water', source: 'database', servingSize: 100, servingUnit: 'g', calories: 116, protein: 26, carbs: 0, fat: 1 },
  { id: 'db-cottage-cheese', name: 'Cottage cheese, low-fat', source: 'database', servingSize: 100, servingUnit: 'g', calories: 72, protein: 12, carbs: 3, fat: 1 },
  { id: 'db-dark-chocolate', name: 'Dark chocolate, 85%', source: 'database', servingSize: 28, servingUnit: 'g', calories: 170, protein: 3, carbs: 13, fat: 12 },
  { id: 'db-aloo-paratha', name: 'Aloo pyaaz paratha', source: 'database', servingSize: 1, servingUnit: 'paratha', calories: 180, protein: 4, carbs: 28, fat: 6 },
  { id: 'db-mixed-veg-sabzi', name: 'Mixed vegetable sabzi', source: 'database', servingSize: 100, servingUnit: 'g', calories: 85, protein: 2, carbs: 10, fat: 4 },
];

/** Index by id for O(1) lookup when logging. */
const BY_ID = new Map(FOOD_DB.map((f) => [f.id, f]));

/**
 * Fallback resolver for ids that aren't in the seed DB — set by the live
 * search layer so remote (OpenFoodFacts/USDA) items surfaced in search can be
 * resolved when logged. Kept as a hook to avoid a circular import.
 */
let externalResolver: ((id: string) => FoodItem | undefined) | null = null;

export function registerFoodResolver(fn: (id: string) => FoodItem | undefined): void {
  externalResolver = fn;
}

export function getFoodById(id: string): FoodItem | undefined {
  return BY_ID.get(id) ?? externalResolver?.(id);
}

/**
 * Case-insensitive fuzzy-ish search over name + brand. Results are ranked so
 * that prefix matches beat substring matches, and shorter names win ties —
 * "chicken" surfaces "Chicken breast" above "…with chicken".
 */
export function searchFoods(query: string, limit = 20): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    // Empty query → a sensible default set (favorites first, then staples).
    return FOOD_DB.slice(0, limit);
  }

  const scored = FOOD_DB.map((food) => {
    const name = food.name.toLowerCase();
    const brand = (food.brand ?? '').toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 100 - name.length;
    else if (name.includes(q)) score = 50 - name.length;
    else if (brand.includes(q)) score = 30 - name.length;
    return { food, score };
  }).filter((s) => s.score > -1);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.food);
}
