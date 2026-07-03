import { Router } from 'express';
import type { GoalMode } from '@nutrition/types';
import { buildCoach } from '../domain/coach';
import { generateSampleHistory } from '../domain/sampleData';

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

export default router;
