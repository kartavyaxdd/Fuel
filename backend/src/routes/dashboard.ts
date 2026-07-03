import { Router, Request, Response } from 'express';
import { buildDemoDashboard } from '../domain/dashboard';

const router = Router();

/**
 * GET /api/dashboard
 * Returns the canonical DashboardData assembled from the adaptive energy model,
 * goal projections, and the user's logged history.
 */
router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    res.status(200).json(buildDemoDashboard());
  } catch (error) {
    console.error('Error building dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
