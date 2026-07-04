import { Router } from 'express';
import { generateProgressData, buildProgressForUser } from '../domain/progress';

const router = Router();

router.get('/progress', async (req, res) => {
  const userId = req.headers['x-user-id'] as string | undefined;
  const data = userId ? await buildProgressForUser(userId) : generateProgressData();
  res.json(data);
});

export default router;
