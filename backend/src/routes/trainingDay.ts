import { Router } from 'express';
import { isTrainingDay, setTrainingDay, toggleTrainingDay } from '../domain/trainingDay';

const router = Router();

/** GET /api/training-day — current training day status */
router.get('/training-day', (req, res) => {
  res.json({ isTrainingDay: isTrainingDay() });
});

/**
 * POST /api/training-day — set or toggle training day
 * Body: { isTraining?: boolean }  — omit to toggle
 */
router.post('/training-day', (req, res) => {
  const { isTraining } = req.body ?? {};
  const result = typeof isTraining === 'boolean'
    ? setTrainingDay(isTraining)
    : toggleTrainingDay();
  res.json({ isTrainingDay: result });
});

export default router;
