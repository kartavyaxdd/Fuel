"use client";

import type { EnergyModel } from "@nutrition/types";
import { Panel, PanelHeader } from "./ui/Panel";

/**
 * Adaptive expenditure readout — the MacroFactor-style "the model is
 * learning your metabolism" surface. Confidence drives the meter fill.
 */
export function EnergyPanel({ energy }: { energy: EnergyModel }) {
  const confidencePct = Math.round(energy.confidence * 100);
  const trendingDown = energy.trendDelta < 0;

  return (
    <Panel>
      <PanelHeader title="Adaptive Energy" hint="learned expenditure" />

      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight text-white">
          {Math.round(energy.expenditureEstimate).toLocaleString()}
        </span>
        <span className="text-sm text-white/40">kcal / day</span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-sm">
        <span className={trendingDown ? "text-emerald-400" : "text-orange-400"}>
          {trendingDown ? "▼" : "▲"} {Math.abs(energy.trendDelta).toFixed(2)} kg/wk
        </span>
        <span className="text-white/30">weight trend</span>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-white/50">Model confidence</span>
          <span className="font-medium text-white/70">{confidencePct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/35">
          {confidencePct >= 90
            ? "Dialed in — expenditure estimate is highly reliable."
            : confidencePct >= 50
              ? "Warming up — keep logging to sharpen the estimate."
              : "Gathering data — a couple more weeks unlocks full accuracy."}
        </p>
      </div>
    </Panel>
  );
}
