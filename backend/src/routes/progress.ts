import { Router } from 'express';
import { generateProgressData, buildProgressForUser } from '../domain/progress';

const router = Router();

router.get('/progress', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const data = userId ? await buildProgressForUser(userId) : generateProgressData();
    res.json(data);
  } catch (e) {
    console.error('[progress] error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
