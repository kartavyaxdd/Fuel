import { Router, type Request, type Response } from 'express';
import type { LogWeightRequest } from '@nutrition/types';
import { buildWeightData, logWeight, normalizeRange } from '../domain/weight';

const router = Router();

/** GET /api/weight?range=30|60|90|180 — the weight tracking view. */
router.get('/weight', (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query.range);
    res.json(buildWeightData(range));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/weight — record or overwrite a weigh-in, returns the fresh view. */
router.post('/weight', (req: Request, res: Response) => {
  try {
    const { date, weight } = req.body as Partial<LogWeightRequest>;

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'A valid ISO date (YYYY-MM-DD) is required' });
    }
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 500) {
      return res.status(400).json({ error: 'A valid weight in kg is required' });
    }

    logWeight({ date, weight });
    const range = normalizeRange(req.query.range);
    return res.json(buildWeightData(range));
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
