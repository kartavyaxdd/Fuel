import { Router } from 'express';
import { generateProgressData } from '../domain/progress';

const router = Router();

router.get('/progress', (_req, res) => {
  res.json(generateProgressData());
});

export default router;
