import { Router, Request, Response } from 'express';
import { clearAllFoodLog } from '../domain/foodLog';
import { clearAllWeights } from '../domain/weight';
import { resetGoal } from '../domain/userGoal';
import { clearAllMeasurements } from '../domain/measurements';
import { resetStore } from '../domain/store';

const router = Router();

router.post('/reset', async (req: Request, res: Response) => {
  try {
    clearAllFoodLog();
    clearAllWeights();
    resetGoal();
    clearAllMeasurements();
    await resetStore();
    res.status(200).json({
      message: 'All data cleared — food log, weight history, and goal reset to defaults.',
    });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
