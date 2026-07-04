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
 * Creates a new user. Accepts optional username for cross-chat recovery.
 * Body: { username?: string }
 * Returns { userId, username?, createdAt }.
 */
router.post('/user/register', async (req, res) => {
  try {
    const { username } = req.body ?? {};

    if (username) {
      if (typeof username !== 'string' || username.length < 2) {
        res.status(400).json({ error: 'Username must be at least 2 characters' });
        return;
      }
      const existing = await select('username_index', username.toLowerCase().trim());
      if (existing) {
        res.status(409).json({ error: 'Username already taken. Choose another.' });
        return;
      }
    }

    const userId = generateUUID();
    const now = new Date().toISOString();
    await upsert('user', { id: userId, createdAt: now, username: username ?? null }, userId);

    if (username) {
      await upsert('username_index', { userId, username: username.toLowerCase().trim(), createdAt: now }, username.toLowerCase().trim());
    }

    const out: Record<string, unknown> = { userId, createdAt: now };
    if (username) out.username = username.toLowerCase().trim();
    res.status(201).json(out);
  } catch {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * GET /api/user
 * Returns user info by userId query param.
 */
router.get('/user', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    if (!userId) {
      res.status(401).json({ error: 'userId query parameter is required' });
      return;
    }
    const data = await select('user', userId);
    if (!data) {
      res.status(404).json({ error: 'User not found. Register first via POST /api/user/register.' });
      return;
    }
    res.json({ userId, ...(data as object) });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/lookup
 * Returns user info by username. Lets GPT find a lost userId.
 * Query: username (string, required)
 */
router.get('/user/lookup', async (req, res) => {
  try {
    const username = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : undefined;
    if (!username || username.length < 2) {
      res.status(400).json({ error: 'username query parameter is required (min 2 chars)' });
      return;
    }
    const data = await select('username_index', username);
    if (!data) {
      res.status(404).json({ error: 'Username not found. Register first via POST /api/user/register.' });
      return;
    }
    const { userId, createdAt } = data as { userId: string; createdAt: string };
    res.json({ userId, username, createdAt });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
