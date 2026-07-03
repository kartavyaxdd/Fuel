import type { FoodItem } from '@nutrition/types';
import { searchFoods as searchSeedFoods, registerFoodResolver } from './foodDb';
import { INDIAN_FOOD_DB } from './indianFoodDb';

/**
 * Live food search across the local seed DB plus two public nutrition APIs:
 *   - OpenFoodFacts (branded/packaged foods, barcode-backed, no auth)
 *   - USDA FoodData Central (generic/whole foods, free API key)
 *
 * Remote hits are normalized to `FoodItem` and cached so that (a) repeated
 * queries are cheap and (b) an item surfaced in search can later be logged —
 * `getRemoteFoodById` lets the log layer resolve ids we minted here.
 */

const OFF_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const SEARCH_TTL_MS = 5 * 60 * 1000;
const HTTP_TIMEOUT_MS = 6000;

/** Every remote item we've ever normalized, keyed by its minted id. */
const REMOTE_ITEMS = new Map<string, FoodItem>();

/** Query-result cache: normalized query → { items, expires }. */
interface CacheEntry {
  items: FoodItem[];
  expires: number;
}
const QUERY_CACHE = new Map<string, CacheEntry>();

/** Resolve an item previously returned from a remote search, for logging. */
export function getRemoteFoodById(id: string): FoodItem | undefined {
  return REMOTE_ITEMS.get(id);
}

// Let the log layer (via foodDb.getFoodById) resolve remote items by id.
registerFoodResolver(getRemoteFoodById);

function num(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Fetch with a hard timeout so a slow upstream can't hang the request. */
async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'nutrition-app/1.0 (demo)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenFoodFacts product → FoodItem. OFF macros are per 100 g (…_100g fields),
 * so we model each as a 100 g serving. Skips products missing energy.
 */
function normalizeOff(product: Record<string, unknown>): FoodItem | null {
  const nutr = (product.nutriments ?? {}) as Record<string, unknown>;
  const name =
    (product.product_name as string) ||
    (product.generic_name as string) ||
    '';
  if (!name.trim()) return null;
  const calories = num(nutr['energy-kcal_100g']);
  if (calories <= 0) return null;
  const code = (product.code as string) || '';
  const id = `off-${code || name.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`;
  const item: FoodItem = {
    id,
    name: name.trim(),
    brand: ((product.brands as string) || '').split(',')[0].trim() || undefined,
    source: 'database',
    servingSize: 100,
    servingUnit: 'g',
    calories: Math.round(calories),
    protein: round(num(nutr.proteins_100g)),
    carbs: round(num(nutr.carbohydrates_100g)),
    fat: round(num(nutr.fat_100g)),
    barcode: code || undefined,
  };
  return item;
}

/**
 * USDA food → FoodItem. Nutrients come as a flat list keyed by nutrientName;
 * amounts are per 100 g for Foundation/SR foods, so we use a 100 g serving.
 */
function normalizeUsda(food: Record<string, unknown>): FoodItem | null {
  const name = (food.description as string) || '';
  if (!name.trim()) return null;
  const nutrients = (food.foodNutrients ?? []) as Array<Record<string, unknown>>;
  const pick = (needle: string): number => {
    const hit = nutrients.find((n) =>
      String(n.nutrientName ?? '').toLowerCase().includes(needle),
    );
    return hit ? num(hit.value) : 0;
  };
  const calories = pick('energy');
  if (calories <= 0) return null;
  const fdcId = food.fdcId != null ? String(food.fdcId) : name.slice(0, 20);
  const item: FoodItem = {
    id: `usda-${fdcId}`,
    name: name.trim().replace(/\s+/g, ' '),
    brand: ((food.brandOwner as string) || '').trim() || undefined,
    source: 'database',
    servingSize: 100,
    servingUnit: 'g',
    calories: Math.round(calories),
    protein: round(pick('protein')),
    carbs: round(pick('carbohydrate')),
    fat: round(pick('total lipid')),
  };
  return item;
}

async function searchOff(query: string, limit: number): Promise<FoodItem[]> {
  const url =
    `${OFF_URL}?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit}` +
    `&fields=code,product_name,generic_name,brands,nutriments`;
  const data = (await fetchJson(url)) as { products?: unknown[] } | null;
  if (!data?.products) return [];
  return data.products
    .map((p) => normalizeOff(p as Record<string, unknown>))
    .filter((x): x is FoodItem => x !== null);
}

async function searchUsda(query: string, limit: number): Promise<FoodItem[]> {
  const key = process.env.USDA_API_KEY;
  if (!key) return [];
  const url =
    `${USDA_URL}?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(query)}&pageSize=${limit}` +
    `&dataType=${encodeURIComponent('Foundation,SR Legacy,Branded')}`;
  const data = (await fetchJson(url)) as { foods?: unknown[] } | null;
  if (!data?.foods) return [];
  return data.foods
    .map((f) => normalizeUsda(f as Record<string, unknown>))
    .filter((x): x is FoodItem => x !== null);
}

/** Drop duplicate names, keeping the first (seed > OFF > USDA by call order). */
function dedupe(items: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const item of items) {
    const key = `${item.name.toLowerCase()}|${item.brand?.toLowerCase() ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Ranked search over seed DB + remote APIs. Seed results lead (curated, always
 * fast); remote results fill the tail. Remote calls run in parallel and fail
 * soft — an API being down just means fewer results, never an error.
 */
function searchIndian(query: string, limit: number): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return INDIAN_FOOD_DB.slice(0, limit);
  const scored = INDIAN_FOOD_DB.map((food) => {
    const name = food.name.toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 100 - name.length;
    else if (name.includes(q)) score = 50 - name.length;
    return { food, score };
  }).filter((s) => s.score > -1);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.food);
}

// Register Indian foods so they can be resolved by id for logging.
for (const item of INDIAN_FOOD_DB) {
  REMOTE_ITEMS.set(item.id, item);
}

export async function searchFoodsLive(query: string, limit = 20): Promise<FoodItem[]> {
  const q = query.trim();
  const seed = searchSeedFoods(q, limit);
  if (!q) return seed;

  const cacheKey = `${q.toLowerCase()}|${limit}`;
  const cached = QUERY_CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.items;

  const remoteLimit = Math.max(4, Math.ceil(limit / 2));
  const [off, usda] = await Promise.all([
    searchOff(q, remoteLimit),
    searchUsda(q, remoteLimit),
  ]);

  const indian = searchIndian(q, remoteLimit);
  const merged = dedupe([...seed, ...indian, ...off, ...usda]).slice(0, limit);

  // Register remote items so they can be logged by id later.
  for (const item of merged) {
    if (item.id.startsWith('off-') || item.id.startsWith('usda-')) {
      REMOTE_ITEMS.set(item.id, item);
    }
  }

  QUERY_CACHE.set(cacheKey, { items: merged, expires: now + SEARCH_TTL_MS });
  return merged;
}
