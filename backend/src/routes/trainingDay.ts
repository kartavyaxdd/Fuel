import { Router } from 'express';
import { isTrainingDay, setTrainingDay, toggleTrainingDay } from '../domain/trainingDay';
import { DEMO_ANCHOR_DATE } from '../domain/sampleData';

const router = Router();

/** GET /api/training-day?date=YYYY-MM-DD — training day status for a date */
router.get('/training-day', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
  res.json({ isTrainingDay: isTrainingDay(date) });
});

/**
 * POST /api/training-day — set training day for a date
 * Body: { date?: string, isTraining?: boolean } — omit isTraining to toggle
 */
router.post('/training-day', (req, res) => {
  const { isTraining, date } = req.body ?? {};
  const d = typeof date === 'string' ? date : DEMO_ANCHOR_DATE;
  const result = typeof isTraining === 'boolean'
    ? setTrainingDay(d, isTraining)
    : toggleTrainingDay(d);
  res.json({ isTrainingDay: result, date: d });
});

export default router;
