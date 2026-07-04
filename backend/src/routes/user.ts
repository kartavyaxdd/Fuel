import { Router } from 'express';
import crypto from 'crypto';
import { upsert, select } from '../domain/store';

const router = Router();

function generateUUID(): string {
  return crypto.randomUUID();
}

/** In-memory fallbacks for when Supabase is unavailable (test/dev). */
const inMemoryUsers = new Map<string, { id: string; createdAt: string; username: string | null }>();
const inMemoryUsernameIndex = new Map<string, { userId: string; createdAt: string }>();

/**
 * POST /api/user/register
 * Creates a new user. Accepts optional username for cross-chat recovery.
 * Body: { username?: string }
 * Returns { userId, username?, createdAt }.
 */
router.post('/user/register', async (req, res) => {
  try {
    const { username: rawUsername } = req.body ?? {};
    const username = typeof rawUsername === 'string' ? rawUsername.trim().toLowerCase() : undefined;

    if (username) {
      if (username.length < 2) {
        res.status(400).json({ error: 'Username must be at least 2 characters' });
        return;
      }
      const existing = await select('username_index', username) ?? inMemoryUsernameIndex.get(username);
      if (existing) {
        res.status(409).json({ error: 'Username already taken. Choose another.' });
        return;
      }
    }

    const userId = generateUUID();
    const now = new Date().toISOString();
    await upsert('user', { id: userId, createdAt: now, username: username ?? null }, userId);
    inMemoryUsers.set(userId, { id: userId, createdAt: now, username: username ?? null });

    if (username) {
      await upsert('username_index', { userId, username, createdAt: now }, username);
      inMemoryUsernameIndex.set(username, { userId, createdAt: now });
    }

    const out: Record<string, unknown> = { userId, createdAt: now };
    if (username) out.username = username;
    res.status(201).json(out);
  } catch (e) {
    console.error('[user] register failed:', e);
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
    const data = await select('user', userId) ?? inMemoryUsers.get(userId) ?? null;
    if (!data) {
      res.status(404).json({ error: 'User not found. Register first via POST /api/user/register.' });
      return;
    }
    res.json({ userId, ...(data as object) });
  } catch (e) {
    console.error('[user] get failed:', e);
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
    const data = await select('username_index', username) ?? inMemoryUsernameIndex.get(username);
    if (!data) {
      res.status(404).json({ error: 'Username not found. Register first via POST /api/user/register.' });
      return;
    }
    const { userId, createdAt } = data as { userId: string; createdAt: string };
    res.json({ userId, username, createdAt });
  } catch (e) {
    console.error('[user] lookup failed:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
