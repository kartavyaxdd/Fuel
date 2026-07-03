/**
 * Food logging contract — the core loop of the app.
 *
 * A `FoodItem` is a reusable definition (from the database, a custom entry, or
 * a recipe) whose macros are expressed *per serving*. A `LoggedFood` is a
 * concrete instance of eating some number of servings of a `FoodItem` on a
 * given day, grouped into a meal slot.
 */

/** Which meal slot an entry belongs to. Drives grouping in the day view. */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Where a food definition came from — shapes how it's presented and edited. */
export type FoodSource = 'database' | 'custom' | 'recipe';

/** The macro breakdown of a single serving. Calories are kcal. */
export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * A reusable food definition. Macros are per one `servingSize` of `servingUnit`
 * (e.g. 100 g, 1 cup, 1 scoop). Logging multiplies these by a quantity.
 */
export interface FoodItem extends Macros {
  id: string;
  name: string;
  /** Optional brand / restaurant, shown as a subtitle in search. */
  brand?: string;
  source: FoodSource;
  /** Numeric size of one serving, e.g. 100 (for "100 g") or 1 (for "1 cup"). */
  servingSize: number;
  /** Unit label for the serving, e.g. "g", "cup", "scoop", "slice". */
  servingUnit: string;
  /** Optional barcode for scan-to-log. */
  barcode?: string;
  /** True when the user has starred this for quick access. */
  favorite?: boolean;
  /** For recipes: the component items that make it up. */
  ingredients?: RecipeIngredient[];
  /** How many servings the whole recipe yields (recipes only). */
  servings?: number;
}

/** One component line inside a recipe. */
export interface RecipeIngredient {
  foodId: string;
  name: string;
  quantity: number;
  /** Cached per-serving macros so a recipe total is computable standalone. */
  macros: Macros;
}

/**
 * A concrete eaten entry on a specific date. `quantity` is the number of
 * servings; `macros` is the already-scaled contribution (quantity x per-serving)
 * so day totals are a straight sum without needing the source item.
 */
export interface LoggedFood extends Macros {
  id: string;
  date: string;
  slot: MealSlot;
  foodId: string;
  name: string;
  brand?: string;
  quantity: number;
  servingUnit: string;
  /** ISO timestamp of when it was logged, for ordering within a slot. */
  loggedAt: string;
}

/** A meal slot with its entries and rolled-up totals, for the day view. */
export interface MealGroup {
  slot: MealSlot;
  label: string;
  entries: LoggedFood[];
  totals: Macros;
}

/** The full food log for one day plus targets and progress. */
export interface FoodDay {
  date: string;
  target: Macros;
  consumed: Macros;
  remaining: Macros;
  groups: MealGroup[];
}

/** Response shape for a food search query. */
export interface FoodSearchResult {
  query: string;
  items: FoodItem[];
}

/** Payload to log a food against a day + slot. */
export interface LogFoodRequest {
  date: string;
  slot: MealSlot;
  foodId: string;
  quantity: number;
}
