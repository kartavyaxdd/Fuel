import { Router } from 'express';
import type { GoalMode } from '@nutrition/types';
import { buildCoach } from '../domain/coach';
import { generateSampleHistory } from '../domain/sampleData';
import { isCoachEnabled, chatWithCoach } from '../domain/geminiCoach';

const router = Router();

const VALID_MODES: GoalMode[] = ['fat-loss', 'maintenance', 'lean-bulk', 'recomp'];

function normalizeMode(value: unknown): GoalMode {
  return typeof value === 'string' && (VALID_MODES as string[]).includes(value)
    ? (value as GoalMode)
    : 'fat-loss';
}

function normalizeTargetWeight(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : 78;
}

function normalizeTarget(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 20000 ? n : undefined;
}

router.get('/coach', (req, res) => {
  try {
    const mode = normalizeMode(req.query.mode);
    const targetWeight = normalizeTargetWeight(req.query.targetWeight);
    const currentTarget = normalizeTarget(req.query.currentTarget);
    res.json(
      buildCoach(generateSampleHistory(), { mode, targetWeight, currentTarget }),
    );
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/coach/chat — SSE streaming endpoint.
 * Emits newline-delimited JSON events:
 *   {"type":"thinking"}
 *   {"type":"searching","query":"eggs"}
 *   {"type":"found","name":"Egg","calories":78,...}
 *   {"type":"logging","name":"Egg","slot":"breakfast","quantity":2}
 *   {"type":"logged","name":"Egg","slot":"breakfast","calories":156,...}
 *   {"type":"reply","text":"...coach reply..."}
 *   {"type":"done"}
 *   {"type":"error","message":"..."}
 */
router.post('/coach/chat', async (req, res) => {
  if (!isCoachEnabled()) {
    res.status(503).json({ error: 'Coach unavailable. Set GEMINI_API_KEY.' });
    return;
  }

  const { message, sessionHistory } = req.body ?? {};
  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: object) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await chatWithCoach(message, sessionHistory ?? [], send);
    send({ type: 'done' });
  } catch (e) {
    send({ type: 'error', message: e instanceof Error ? e.message : 'Internal server error' });
  } finally {
    res.end();
  }
});

export default router;
