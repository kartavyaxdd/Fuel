import { Router, type Request, type Response } from 'express';
import type { LogWeightRequest } from '@nutrition/types';
import { buildWeightData, buildWeightDataForUser, logWeight, logWeightForUser, normalizeRange } from '../domain/weight';

const router = Router();

/** GET /api/weight?range=30|60|90|180 — the weight tracking view. */
router.get('/weight', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const range = normalizeRange(req.query.range);
    const data = userId ? await buildWeightDataForUser(range, userId) : buildWeightData(range);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/weight — record or overwrite a weigh-in, returns the fresh view. */
router.post('/weight', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const { date, weight } = req.body as Partial<LogWeightRequest>;

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'A valid ISO date (YYYY-MM-DD) is required' });
    }
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 500) {
      return res.status(400).json({ error: 'A valid weight in kg is required' });
    }

    if (userId) {
      await logWeightForUser({ date, weight }, userId);
    } else {
      logWeight({ date, weight });
    }
    const range = normalizeRange(req.query.range);
    const data = userId ? await buildWeightDataForUser(range, userId) : buildWeightData(range);
    return res.json(data);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
