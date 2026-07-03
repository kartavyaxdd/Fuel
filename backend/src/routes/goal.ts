import { Router, Request, Response } from 'express';
import type { SetGoalRequest } from '@nutrition/types';
import { getGoal, setGoal } from '../domain/userGoal';

const router = Router();

/**
 * GET /api/goal
 * Returns the active user goal (mode, target/start weight, start date).
 */
router.get('/goal', (_req: Request, res: Response) => {
  try {
    res.status(200).json(getGoal());
  } catch (error) {
    console.error('Error reading goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/goal
 * Set (overwrite) the active goal from an onboarding submission.
 */
router.post('/goal', (req: Request, res: Response) => {
  try {
    const body = req.body as SetGoalRequest;
    const goal = setGoal(body);
    res.status(200).json(goal);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid goal';
    res.status(400).json({ error: message });
  }
});

export default router;
