import { Router } from 'express';
import { logMeasurement, getMeasurements, getLatestMeasurement } from '../domain/measurements';

const router = Router();

/** GET /api/measurements — all entries oldest→newest + latest snapshot */
router.get('/measurements', (req, res) => {
  try {
    res.json({
      measurements: getMeasurements(),
      latest: getLatestMeasurement(),
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/measurements — log a new measurement.
 *
 * Body (all optional except at least one measurement field):
 *   date?       — ISO date, defaults to demo anchor
 *   waist?      — cm
 *   hips?       — cm
 *   chest?      — cm
 *   armLeft?    — cm
 *   armRight?   — cm
 *   thigh?      — cm
 *   neck?       — cm (used for Navy BF% calculation)
 *   height?     — cm (used for Navy BF% calculation)
 *   sex?        — 'male' | 'female' (default: male)
 *   bodyFat?    — % (if provided directly; otherwise auto-computed if waist+neck+height given)
 */
router.post('/measurements', (req, res) => {
  try {
    const body = req.body ?? {};
    const entry = logMeasurement(body);
    res.status(201).json(entry);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Bad request' });
  }
});

export default router;
