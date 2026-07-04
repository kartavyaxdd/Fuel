import { Router, Request, Response } from 'express';
import type { SetGoalRequest } from '@nutrition/types';
import { getGoal, getGoalForUser, setGoal, setGoalForUser } from '../domain/userGoal';

const router = Router();

/**
 * GET /api/goal
 * Returns the active user goal (mode, target/start weight, start date).
 */
router.get('/goal', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const goal = userId ? await getGoalForUser(userId) : getGoal();
    res.status(200).json(goal);
  } catch (error) {
    console.error('Error reading goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/goal
 * Set (overwrite) the active goal from an onboarding submission.
 */
router.post('/goal', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const body = req.body as SetGoalRequest;
    const goal = userId ? await setGoalForUser(body, userId) : setGoal(body);
    res.status(200).json(goal);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid goal';
    res.status(400).json({ error: message });
  }
});

export default router;
