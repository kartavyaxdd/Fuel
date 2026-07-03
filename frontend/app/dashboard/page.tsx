"use client";

import { useEffect, useState } from "react";
import type { DashboardData } from "@nutrition/types";
import { apiGet } from "@/lib/api";
import { CalorieRing } from "@/components/CalorieRing";
import { MacroBar } from "@/components/MacroBar";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { EnergyPanel } from "@/components/EnergyPanel";
import { GoalPanel } from "@/components/GoalPanel";
import { GoalSetupModal } from "@/components/GoalSetupModal";
import { Panel, PanelHeader } from "@/components/ui/Panel";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);

  function loadDashboard() {
    return apiGet<DashboardData>("/dashboard")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }

  useEffect(() => {
    let alive = true;
    apiGet<DashboardData>("/dashboard")
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <SkeletonState />;

  const today = new Date(data.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/40">{today}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Today
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGoalOpen(true)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur-xl transition hover:bg-white/[0.08] hover:text-white"
          >
            Edit goal
          </button>
          <AdherenceBadge value={data.weeklyAdherence} />
        </div>
      </header>

      <GoalSetupModal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        onSaved={() => loadDashboard()}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Calories + macros hero */}
        <Panel className="lg:col-span-2">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
            <CalorieRing
              consumed={data.calories.consumed}
              target={data.calories.target}
              remaining={data.calories.remaining}
            />
            <div className="w-full flex-1 space-y-4">
              <MacroBar label="Protein" macro={data.macros.protein} accent="protein" />
              <MacroBar label="Carbs" macro={data.macros.carbs} accent="carbs" />
              <MacroBar label="Fat" macro={data.macros.fat} accent="fat" />
            </div>
          </div>
        </Panel>

        <GoalPanel goal={data.goal} />
        <EnergyPanel energy={data.energy} />

        {/* Weight trend */}
        <Panel className="lg:col-span-2">
          <PanelHeader title="Weight Trend" hint="scale vs. smoothed trend" />
          <WeightTrendChart series={data.weightSeries} />
        </Panel>

        {/* Meals */}
        <Panel className="lg:col-span-3">
          <PanelHeader
            title="Today's Meals"
            hint={`${data.meals.length} logged`}
          />
          {data.meals.length === 0 ? (
            <div className="py-10 text-center text-white/30">
              Nothing logged yet — add your first meal.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.meals.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-white">{m.name}</div>
                    <div className="text-xs text-white/40">
                      {m.time ?? "—"} · {m.protein}p · {m.carbs}c · {m.fat}f
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-white/80">
                    {m.calories} kcal
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {data.notes ? (
        <p className="mt-6 text-center text-sm text-white/40">{data.notes}</p>
      ) : null}
    </div>
  );
}

function AdherenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = "text-white";
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur-xl">
      <span className="text-xs text-white/40">Weekly adherence </span>
      <span className={`text-sm font-semibold ${tone}`}>{pct}%</span>
    </div>
  );
}

function SkeletonState() {
  return (
    <div>
      <div className="mb-8 h-10 w-40 animate-pulse rounded-lg bg-white/5" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-48 animate-pulse rounded-2xl bg-white/5 ${
              i === 0 ? "lg:col-span-2" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 text-4xl">⚠️</div>
      <h1 className="text-lg font-semibold text-white">Couldn&apos;t load your dashboard</h1>
      <p className="mt-2 text-sm text-white/40">{message}</p>
      <p className="mt-4 text-xs text-white/30">
        Make sure the API is running on port 3001.
      </p>
    </div>
  );
}
