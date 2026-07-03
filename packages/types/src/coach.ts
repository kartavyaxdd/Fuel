import type { GoalMode } from './dashboard';

/**
 * AI Coach model shared across backend and frontend.
 *
 * The coach is *not* a chatbot. It reads the user's adaptive expenditure,
 * trend weight, adherence, and plateau state and returns a prioritized,
 * grounded briefing: where things stand, the single biggest lever right now,
 * concrete target adjustments, and specific action items — each justified by
 * the underlying data rather than generic advice.
 */

export type CoachTone = 'positive' | 'neutral' | 'warning' | 'action';

export type CoachCategory =
  | 'calories'
  | 'macros'
  | 'activity'
  | 'adherence'
  | 'recovery';

/** An optional signed numeric change attached to a recommendation. */
export interface CoachDelta {
  label: string;
  value: number;
  unit: string;
}

/** A single prioritized, data-grounded recommendation card. */
export interface CoachRecommendation {
  id: string;
  tone: CoachTone;
  category: CoachCategory;
  title: string;
  /** Why this matters, tied to the user's own numbers. */
  rationale: string;
  /** The concrete next step to take. */
  action: string;
  /** Optional numeric change (e.g. calorie adjustment). */
  delta?: CoachDelta;
  /** 1 = highest priority. */
  priority: number;
}

/** A retrospective read on the most recent training/nutrition window. */
export interface CoachCheckIn {
  periodLabel: string;
  /** Mean logged intake across the window (kcal). Null if nothing logged. */
  avgIntake: number | null;
  /** Learned average daily expenditure across the window (kcal). */
  avgExpenditure: number;
  /** avgIntake - avgExpenditure (daily kcal balance). Null if no intake. */
  energyBalance: number | null;
  /** Change in trend weight across the window (kg, signed). */
  weightTrendDelta: number;
  /** Fraction of logged days on target (0-1). */
  adherence: number;
  /** Narrative verdict for the window. */
  verdict: string;
}

/** The coach's recommended calorie + macro targets and why. */
export interface CoachTargets {
  /** The target the user is presumed to be running now. */
  current: number;
  /** The engine's recommended daily calorie target. */
  recommended: number;
  /** recommended - current. */
  delta: number;
  /** Recommended macros (grams). */
  protein: number;
  carbs: number;
  fat: number;
  rationale: string;
}

/** Full AI Coach payload. */
export interface CoachData {
  generatedAt: string;
  mode: GoalMode;
  /** One-line greeting / top-level read. */
  headline: string;
  /** 2-3 sentence assessment of the current state. */
  summary: string;
  /** The single biggest lever to pull right now. */
  focus: string;
  /** Model confidence in these recommendations (0-1). */
  confidence: number;
  checkIn: CoachCheckIn;
  targets: CoachTargets;
  recommendations: CoachRecommendation[];
  /** Reflective prompts to consider before the next check-in. */
  talkingPoints: string[];
}

/* ----------------------------------------------------------- Chat types */

/** A single message in a chat session with the brutal AI coach. */
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

/** Body sent from the frontend when the user sends a chat message. */
export interface ChatRequest {
  message: string;
  /** Optional prior history so the model can maintain context. */
  sessionHistory?: ChatMessage[];
}

/** Response returned by the backend after the coach generates a reply. */
export interface ChatResponse {
  reply: string;
}
