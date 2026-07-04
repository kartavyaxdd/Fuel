import { Router, Request, Response } from 'express';
import type { FoodSearchResult, LogFoodRequest, MealSlot } from '@nutrition/types';
import { MEAL_SLOTS } from '@nutrition/types';
import { searchFoodsLive } from '../domain/foodSearch';
import {
  buildFoodDay,
  clearDay,
  copyDay,
  deleteLoggedFood,
  logFood,
  getRecentFoods,
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
 * GET /api/food/recent?limit=N
 * Returns top-N most frequently logged foods across all dates.
 */
router.get('/food/recent', (req: Request, res: Response) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
    res.status(200).json({ items: getRecentFoods(limit) });
  } catch (error) {
    console.error('Error getting recent foods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/food/day?date=YYYY-MM-DD
 * The full day view: targets, consumed, remaining, and meal groups.
 */
router.get('/food/day', (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
    res.status(200).json(buildFoodDay(date));
  } catch (error) {
    console.error('Error building food day:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/food/log
 * Body: LogFoodRequest. Appends an entry and returns the updated FoodDay.
 */
router.post('/food/log', (req: Request, res: Response) => {
  try {
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
    logFood(body.date, body.slot, body.foodId, body.quantity, loggedAt);
    res.status(201).json(buildFoodDay(body.date));
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
router.delete('/food/log/:id', (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
    const removed = deleteLoggedFood(date, req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.status(200).json(buildFoodDay(date));
  } catch (error) {
    console.error('Error deleting logged food:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/food/day?date=YYYY-MM-DD
 * Clear all logged entries for a date.
 */
router.delete('/food/day', (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
    const count = clearDay(date);
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
router.post('/food/copy', (req: Request, res: Response) => {
  try {
    const from = typeof req.body?.from === 'string' ? req.body.from : '';
    const to = typeof req.body?.to === 'string' ? req.body.to : '';
    if (!from || !to) {
      res.status(400).json({ error: 'Both from and to dates are required' });
      return;
    }
    copyDay(from, to, new Date().toISOString());
    res.status(200).json(buildFoodDay(to));
  } catch (error) {
    console.error('Error copying day:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
