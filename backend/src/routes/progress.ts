import { Router } from 'express';
import { generateProgressData, buildProgressForUser } from '../domain/progress';

const router = Router();

router.get('/progress', async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const data = userId ? await buildProgressForUser(userId) : generateProgressData();
  res.json(data);
});

export default router;
