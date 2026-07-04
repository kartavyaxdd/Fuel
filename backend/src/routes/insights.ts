import { Router } from 'express';
import type { GoalMode } from '@nutrition/types';
import { buildInsights, buildInsightsForUser } from '../domain/insights';
import { buildDailyRecords } from '../domain/dailyRecords';

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

router.get('/insights', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const data = userId ? await buildInsightsForUser(userId) : buildInsights(buildDailyRecords(), { mode: normalizeMode(req.query.mode), targetWeight: normalizeTargetWeight(req.query.targetWeight) });
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
