import { Router } from 'express';
import { isTrainingDay, isTrainingDayForUser, setTrainingDay, setTrainingDayForUser, toggleTrainingDay } from '../domain/trainingDay';
import { DEMO_ANCHOR_DATE } from '../domain/sampleData';

const router = Router();

/** GET /api/training-day?date=YYYY-MM-DD — training day status for a date */
router.get('/training-day', async (req, res) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : DEMO_ANCHOR_DATE;
  const result = userId ? await isTrainingDayForUser(date, userId) : isTrainingDay(date);
  res.json({ isTrainingDay: result });
});

/**
 * POST /api/training-day — set training day for a date
 * Body: { date?: string, isTraining?: boolean } — omit isTraining to toggle
 */
router.post('/training-day', async (req, res) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  const { isTraining, date } = req.body ?? {};
  const d = typeof date === 'string' ? date : DEMO_ANCHOR_DATE;
  const result = typeof isTraining === 'boolean'
    ? userId
      ? await setTrainingDayForUser(d, isTraining, userId)
      : setTrainingDay(d, isTraining)
    : userId
      ? await setTrainingDayForUser(d, !(await isTrainingDayForUser(d, userId)), userId)
      : toggleTrainingDay(d);
  res.json({ isTrainingDay: result, date: d });
});

export default router;
