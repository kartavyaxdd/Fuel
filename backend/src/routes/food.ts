import { Router, Request, Response } from 'express';
import type { FoodSearchResult, LogFoodRequest, MealSlot } from '@nutrition/types';
import { MEAL_SLOTS } from '@nutrition/types';
import { searchFoodsLive } from '../domain/foodSearch';
import { analyzeFoodPhoto } from '../domain/geminiCoach';
import {
  buildFoodDay,
  buildFoodDayForUser,
  clearDay,
  clearDayForUser,
  copyDay,
  copyDayForUser,
  deleteLoggedFood,
  deleteLoggedFoodForUser,
  logFood,
  logFoodForUser,
  getRecentFoods,
  getRecentFoodsForUser,
} from '../domain/foodLog';
import { DEMO_ANCHOR_DATE } from '../domain/sampleData';

const router = Router();

function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === 'string' && (MEAL_SLOTS as string[]).includes(value);
}

/**
 * GET /api/food/search?q=...&limit=...
 * Ranked search over the seed food database, merged with live results from
 * OpenFoodFacts + USDA. Remote lookups fail soft, so this never 500s on an
 * upstream outage — it just returns fewer items.
 */
router.get('/food/search', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
    const result: FoodSearchResult = { query, items: await searchFoodsLive(query, limit) };
    res.status(200).json(result);
  } catch (error) {
    console.error('Error searching foods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/food/barcode?code=XXXXXXXX
 * Lookup a food by barcode via OpenFoodFacts. Returns single best match or 404.
 */
router.get('/food/barcode', async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    if (!code) {
      res.status(400).json({ error: 'code param required' });
      return;
    }
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
    const r = await fetch(url, { headers: { 'User-Agent': 'FuelApp/1.0' }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      res.status(502).json({ error: 'OpenFoodFacts unavailable' });
      return;
    }
    const json = await r.json() as { status: number; product?: Record<string, unknown> };
    if (json.status !== 1 || !json.product) {
      res.status(404).json({ error: 'Barcode not found' });
      return;
    }
    const p = json.product;
    const n = p.nutriments as Record<string, number> ?? {};
    const item = {
      id: `off-${code}`,
      name: (p.product_name as string) || 'Unknown product',
      brand: (p.brands as string) || undefined,
      calories: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
      protein: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
      carbs: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
      servingSize: 100,
      servingUnit: 'g',
      barcode: code,
      source: 'openfoodfacts',
    };
    res.status(200).json({ item });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: 'Barcode lookup failed' });
  }
});

/**
 * GET /api/food/recent?limit=N
 * Returns top-N most frequently logged foods across all dates.
 */
router.get('/food/recent', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
    const slot = typeof req.query.slot === 'string' ? req.query.slot : undefined;
    const maxDaysRaw = Number(req.query.maxDays);
    const maxDays = Number.isFinite(maxDaysRaw) && maxDaysRaw > 0 ? maxDaysRaw : undefined;
    const items = userId ? await getRecentFoodsForUser(limit, { slot, maxDays }, userId) : getRecentFoods(limit, { slot, maxDays });
    res.status(200).json({ items });
  } catch (error) {
    console.error('Error getting recent foods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/food/analyze-photo
 * Body: { image: "data:image/jpeg;base64,...", slot?: "lunch" }
 * Uses Gemini Vision to identify foods in a photo and estimate macros.
 * Returns identified foods plus closest DB matches for logging.
 */
router.post('/food/analyze-photo', async (req: Request, res: Response) => {
  try {
    const { image, slot } = req.body ?? {};
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'image (base64 data URL) is required' });
      return;
    }
    const match = image.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'Invalid image format. Use a base64 data URL (image/png, image/jpeg, or image/webp).' });
      return;
    }
    const mimeType = match[1];
    const base64Data = match[3];

    const analysis = await analyzeFoodPhoto(base64Data, mimeType);

    // Find closest DB match for each identified food
    const items = await Promise.all(
      analysis.foods.map(async (food) => {
        const results = await searchFoodsLive(food.name, 5);
        return {
          name: food.name,
          estimatedCalories: food.estimatedCalories,
          estimatedProtein: food.estimatedProtein,
          estimatedCarbs: food.estimatedCarbs,
          estimatedFat: food.estimatedFat,
          servingSize: food.servingSize,
          confidence: food.confidence,
          matches: results.slice(0, 3).map((r) => ({
            id: r.id,
            name: r.name,
            calories: r.calories,
            protein: r.protein,
            carbs: r.carbs,
            fat: r.fat,
            servingSize: r.servingSize,
            servingUnit: r.servingUnit,
          })),
        };
      }),
    );

    res.json({ items, slot: slot ?? null });
  } catch (error) {
    console.error('Photo analysis error:', error);
    res.status(500).json({ error: 'Photo analysis failed' });
  }
});

/**
 * GET /api/food/day?date=YYYY-MM-DD
 * The full day view: targets, consumed, remaining, and meal groups.
 */
router.get('/food/day', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
    const day = userId ? await buildFoodDayForUser(date, userId) : buildFoodDay(date);
    res.status(200).json(day);
  } catch (error) {
    console.error('Error building food day:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/food/log
 * Body: LogFoodRequest. Appends an entry and returns the updated FoodDay.
 */
router.post('/food/log', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const body = req.body as Partial<LogFoodRequest>;
    if (
      typeof body.date !== 'string' ||
      !isMealSlot(body.slot) ||
      typeof body.foodId !== 'string' ||
      typeof body.quantity !== 'number' ||
      body.quantity <= 0
    ) {
      res.status(400).json({ error: 'Invalid log request' });
      return;
    }
    const loggedAt = new Date().toISOString();
    if (userId) {
      await logFoodForUser(body.date, body.slot, body.foodId, body.quantity, loggedAt, userId);
      res.status(201).json(await buildFoodDayForUser(body.date, userId));
    } else {
      logFood(body.date, body.slot, body.foodId, body.quantity, loggedAt);
      res.status(201).json(buildFoodDay(body.date));
    }
  } catch (error) {
    console.error('Error logging food:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(message.startsWith('Unknown food') ? 400 : 500).json({ error: message });
  }
});

/**
 * DELETE /api/food/log/:id?date=YYYY-MM-DD
 * Removes an entry and returns the updated FoodDay.
 */
router.delete('/food/log/:id', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
    if (userId) {
      const removed = await deleteLoggedFoodForUser(date, req.params.id, userId);
      if (!removed) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      res.status(200).json(await buildFoodDayForUser(date, userId));
    } else {
      const removed = deleteLoggedFood(date, req.params.id);
      if (!removed) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      res.status(200).json(buildFoodDay(date));
    }
  } catch (error) {
    console.error('Error deleting logged food:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/food/day?date=YYYY-MM-DD
 * Clear all logged entries for a date.
 */
router.delete('/food/day', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
    const count = userId ? await clearDayForUser(date, userId) : clearDay(date);
    res.status(200).json({ cleared: count, date, message: `Cleared ${count} entries for ${date}` });
  } catch (error) {
    console.error('Error clearing day:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/food/copy
 * Body: { from: string; to: string }. Copies a day's entries ("copy yesterday").
 */
router.post('/food/copy', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const from = typeof req.body?.from === 'string' ? req.body.from : '';
    const to = typeof req.body?.to === 'string' ? req.body.to : '';
    if (!from || !to) {
      res.status(400).json({ error: 'Both from and to dates are required' });
      return;
    }
    if (userId) {
      await copyDayForUser(from, to, new Date().toISOString(), userId);
      res.status(200).json(await buildFoodDayForUser(to, userId));
    } else {
      copyDay(from, to, new Date().toISOString());
      res.status(200).json(buildFoodDay(to));
    }
  } catch (error) {
    console.error('Error copying day:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
