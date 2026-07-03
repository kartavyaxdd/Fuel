"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeightData, WeightRange } from "@nutrition/types";
import { WEIGHT_RANGES } from "@nutrition/types";
import { apiGet, apiPost } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { WeightTrendChart } from "@/components/WeightTrendChart";

const RANGE_LABELS: Record<WeightRange, string> = {
  30: "30D",
  60: "60D",
  90: "90D",
  180: "6M",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
  hint?: string;
}) {
  const toneClass = "text-white";
  return (
    <Panel className="flex flex-col gap-1">
      <div className="text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint ? <div className="text-xs text-white/30">{hint}</div> : null}
    </Panel>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 w-40 rounded-lg bg-white/5" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-white/5" />
    </div>
  );
}

export default function WeightPage() {
  const [data, setData] = useState<WeightData | null>(null);
  const [range, setRange] = useState<WeightRange>(90);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [entryDate, setEntryDate] = useState(todayISO());
  const [entryWeight, setEntryWeight] = useState("");

  useEffect(() => {
    let alive = true;
    apiGet<WeightData>(`/weight?range=${range}`)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      alive = false;
    };
  }, [range]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const weight = Number(entryWeight);
      if (!Number.isFinite(weight) || weight <= 0) {
        setError("Enter a valid weight in kg");
        return;
      }
      setBusy(true);
      try {
        const updated = await apiPost<WeightData>(`/weight?range=${range}`, {
          date: entryDate,
          weight,
        });
        setData(updated);
        setEntryWeight("");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log weight");
      } finally {
        setBusy(false);
      }
    },
    [entryDate, entryWeight, range],
  );

  const stats = data?.stats;

  const rateTone = useMemo<"good" | "warn" | "neutral">(() => {
    if (!stats) return "neutral";
    if (stats.weeklyRate < 0) return "good";
    if (stats.weeklyRate > 0) return "warn";
    return "neutral";
  }, [stats]);

  if (!data && !error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 lg:py-10">
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">
            Body Composition
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Weight
          </h1>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {WEIGHT_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {stats ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Trend"
            value={`${stats.currentTrend.toFixed(1)} kg`}
            hint={
              stats.latestScale != null
                ? `last scale ${stats.latestScale.toFixed(1)} kg`
                : "no scale entry"
            }
          />
          <StatCard
            label="Weekly rate"
            value={`${stats.weeklyRate > 0 ? "+" : ""}${stats.weeklyRate.toFixed(1)} kg`}
            tone={rateTone}
            hint="last 7 days"
          />
          <StatCard
            label={`Change (${stats.windowDays}d)`}
            value={`${stats.totalChange > 0 ? "+" : ""}${stats.totalChange.toFixed(1)} kg`}
            tone={stats.totalChange < 0 ? "good" : stats.totalChange > 0 ? "warn" : "neutral"}
          />
          <StatCard
            label="Entries"
            value={`${stats.entriesLogged}`}
            hint={`range ${stats.lowestTrend.toFixed(1)}–${stats.highestTrend.toFixed(1)}`}
          />
        </div>
      ) : null}

      <Panel className="mb-6">
        <PanelHeader
          title="Trend"
          hint={data ? `${data.series.length} days` : undefined}
        />
        {data ? <WeightTrendChart series={data.series} /> : null}
      </Panel>

      <Panel>
        <PanelHeader title="Log a weigh-in" hint="kg" />
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-white/40">
            Date
            <input
              type="date"
              value={entryDate}
              max={todayISO()}
              onChange={(e) => setEntryDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/40">
            Weight (kg)
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="83.5"
              value={entryWeight}
              onChange={(e) => setEntryWeight(e.target.value)}
              className="w-32 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          </label>
          <button
            type="submit"
            disabled={busy || entryWeight.trim() === ""}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : "Log weight"}
          </button>
        </form>
        <p className="mt-3 text-xs text-white/30">
          Logging the same day overwrites that entry. The trend line recalculates
          instantly.
        </p>
      </Panel>
    </div>
  );
}
