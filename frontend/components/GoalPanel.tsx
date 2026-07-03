"use client";

import type { GoalProgress } from "@nutrition/types";
import { Panel, PanelHeader } from "./ui/Panel";

const GOAL_LABELS: Record<GoalProgress["mode"], string> = {
  "fat-loss": "Fat Loss",
  maintenance: "Maintenance",
  "lean-bulk": "Lean Bulk",
  recomp: "Recomposition",
};

export function GoalPanel({ goal }: { goal: GoalProgress }) {
  const pct = Math.round(Math.min(1, Math.max(0, goal.progress)) * 100);
  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <Panel>
      <PanelHeader title="Goal" hint={GOAL_LABELS[goal.mode]} />

      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <defs>
              <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="url(#goalGrad)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{pct}%</span>
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              complete
            </span>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-white/40">Target change</div>
            <div className="font-semibold text-white">
              {goal.targetWeightDelta > 0 ? "+" : ""}
              {goal.targetWeightDelta.toFixed(1)} kg
            </div>
          </div>
          <div>
            <div className="text-white/40">Est. time left</div>
            <div className="font-semibold text-white">
              {goal.etaWeeks === null
                ? "—"
                : `${goal.etaWeeks.toFixed(1)} wk${goal.etaWeeks >= 2 ? "s" : ""}`}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
