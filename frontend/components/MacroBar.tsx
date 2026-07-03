"use client";

import type { MacroTarget } from "@nutrition/types";

const ACCENTS: Record<string, { from: string; to: string; text: string }> = {
  protein: { from: "#fb923c", to: "#f97316", text: "text-orange-300" },
  carbs: { from: "#22d3ee", to: "#0ea5e9", text: "text-cyan-300" },
  fat: { from: "#a78bfa", to: "#8b5cf6", text: "text-violet-300" },
};

export function MacroBar({
  label,
  macro,
  accent,
}: {
  label: string;
  macro: MacroTarget;
  accent: keyof typeof ACCENTS;
}) {
  const { from, to, text } = ACCENTS[accent];
  const pct = macro.target > 0 ? Math.min((macro.consumed / macro.target) * 100, 100) : 0;
  const over = macro.remaining < 0;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-white/70">{label}</span>
        <span className={`text-xs font-semibold ${text}`}>
          {macro.consumed}
          <span className="text-white/30"> / {macro.target}g</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${from}, ${to})`,
          }}
        />
      </div>
      <div className="mt-1.5 text-xs text-white/40">
        {over ? (
          <span className="text-red-400">{Math.abs(macro.remaining)}g over</span>
        ) : (
          <span>{macro.remaining}g left</span>
        )}
      </div>
    </div>
  );
}
