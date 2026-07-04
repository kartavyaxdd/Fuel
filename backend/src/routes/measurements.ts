import { Router } from 'express';
import { getMeasurementsForUser, logMeasurementForUser, getMeasurements, logMeasurement, getLatestMeasurement } from '../domain/measurements';

const router = Router();

/** GET /api/measurements — all entries oldest→newest + latest snapshot */
router.get('/measurements', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (userId) {
      const measurements = await getMeasurementsForUser(userId);
      res.json({ measurements, latest: measurements.length > 0 ? measurements[measurements.length - 1] : null });
    } else {
      res.json({
        measurements: getMeasurements(),
        latest: getLatestMeasurement(),
      });
    }
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
router.post('/measurements', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined;
    const body = req.body ?? {};
    const entry = userId ? await logMeasurementForUser(body, userId) : logMeasurement(body);
    res.status(201).json(entry);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Bad request' });
  }
});

export default router;
