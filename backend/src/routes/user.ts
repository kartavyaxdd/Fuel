import { Router } from 'express';
import { upsert, select } from '../domain/store';

const router = Router();

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * POST /api/user/register
 * Creates a new user ID and returns it. The GPT calls this when a new
 * conversation starts with no existing user ID. Returns a UUID that the
 * GPT should store and send as X-User-Id on all subsequent requests.
 */
router.post('/user/register', async (_req, res) => {
  try {
    const userId = generateUUID();
    const now = new Date().toISOString();
    await upsert('user', { id: userId, createdAt: now }, userId);
    res.status(201).json({ userId, createdAt: now });
  } catch {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * GET /api/user
 * Returns user info for the authenticated user (X-User-Id header).
 * 401 if no userId provided, 404 if userId not found.
 */
router.get('/user', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    if (!userId) {
      res.status(401).json({ error: 'X-User-Id header is required' });
      return;
    }
    const data = await select('user', userId);
    if (!data) {
      res.status(404).json({ error: 'User not found. Register first via POST /api/user/register.' });
      return;
    }
    res.json({ userId, createdAt: (data as any).createdAt });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
