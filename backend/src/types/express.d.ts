import { Request } from 'express';
import type { UserGoal } from '@nutrition/types';

export interface AuthRequest extends Request {
  user?: UserGoal | null;
}