import { Router, Request, Response } from 'express';
import { buildDemoDashboard, buildDashboardForUser } from '../domain/dashboard';

const router = Router();

/**
 * GET /api/dashboard
 * Returns the canonical DashboardData assembled from the adaptive energy model,
 * goal projections, and the user's logged history.
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined;
    const data = userId ? await buildDashboardForUser(userId) : buildDemoDashboard();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error building dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
