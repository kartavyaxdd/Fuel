"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GoalMode,
  Insight,
  InsightsData,
  WeekSummary,
} from "@nutrition/types";
import { apiGet } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";

const MODES: { value: GoalMode; label: string }[] = [
  { value: "fat-loss", label: "Fat loss" },
  { value: "maintenance", label: "Maintain" },
  { value: "lean-bulk", label: "Lean bulk" },
  { value: "recomp", label: "Recomp" },
];

function fmtKg(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)} kg`;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ---------------------------------------------------------------- Stat card */

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn";
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

/* --------------------------------------------------------------- Highlights */

const TONE_STYLE: Record<
  Insight["tone"],
  { dot: string; ring: string; glyph: string }
> = {
  positive: {
    dot: "bg-white/70",
    ring: "border-white/10 bg-white/[0.04]",
    glyph: "M20 6 9 17l-5-5",
  },
  neutral: {
    dot: "bg-white/70",
    ring: "border-white/10 bg-white/[0.04]",
    glyph: "M12 16v-4M12 8h.01",
  },
  warning: {
    dot: "bg-white/70",
    ring: "border-white/10 bg-white/[0.04]",
    glyph: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  },
};

function HighlightCard({ insight }: { insight: Insight }) {
  const s = TONE_STYLE[insight.tone];
  return (
    <div className={`rounded-2xl border p-4 ${s.ring}`}>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${s.dot}/15`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={s.glyph} />
          </svg>
        </span>
        <h3 className="text-sm font-semibold text-white/90">{insight.title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-white/50">{insight.detail}</p>
    </div>
  );
}

/* ------------------------------------------------------ Weekly rate bar chart */

function WeeklyRateChart({ weeks }: { weeks: WeekSummary[] }) {
  const rows = weeks.filter((w) => w.weeklyRate != null);
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-white/30">
        Not enough history yet
      </div>
    );
  }

  const width = 640;
  const height = 200;
  const pad = { top: 16, right: 16, bottom: 28, left: 16 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const rates = rows.map((w) => w.weeklyRate as number);
  const maxAbs = Math.max(0.1, ...rates.map((r) => Math.abs(r)));
  const zeroY = pad.top + innerH / 2;
  const bandW = innerW / rows.length;
  const barW = Math.min(28, bandW * 0.55);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-52 w-full"
      preserveAspectRatio="none"
    >
      {/* zero baseline */}
      <line
        x1={pad.left}
        y1={zeroY}
        x2={width - pad.right}
        y2={zeroY}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />
      {rows.map((w, i) => {
        const r = w.weeklyRate as number;
        const cx = pad.left + bandW * i + bandW / 2;
        const h = (Math.abs(r) / maxAbs) * (innerH / 2);
        const up = r > 0;
        const yTop = up ? zeroY : zeroY - h;
        // For fat-loss context: losing (negative) is good → brighter.
        const good = r < 0;
        const fill = good ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)";
        return (
          <g key={w.weekStart}>
            <rect
              x={cx - barW / 2}
              y={yTop}
              width={barW}
              height={Math.max(2, h)}
              rx={3}
              fill={fill}
              opacity={0.85}
            />
            {i % 2 === 0 || rows.length <= 8 ? (
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className="fill-white/30"
                fontSize="10"
              >
                {w.weekStart.slice(5)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ Skeleton */

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 w-48 rounded-lg bg-white/5" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white/5" />
    </div>
  );
}

/* ------------------------------------------------------------------- Segment */

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: GoalMode;
  onChange: (m: GoalMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
            mode === m.value
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/45 hover:text-white/70"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- Page */

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [mode, setMode] = useState<GoalMode>("fat-loss");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: GoalMode) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<InsightsData>(`/insights?mode=${m}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(mode);
  }, [load, mode]);

  const recentWeeks = useMemo(
    () => (data ? [...data.weeks].reverse().slice(0, 8) : []),
    [data],
  );

  if (loading && !data) {
    return <Skeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Insights
          </h1>
          <p className="mt-1 text-sm text-white/40">
            What your logs actually say — trends, adherence, and where you land.
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} disabled={loading} />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Calorie target"
              value={`${data.calorieTarget.toLocaleString()}`}
              hint="kcal / day"
            />
            <StatCard
              label="Est. expenditure"
              value={`${data.expenditure.estimate.toLocaleString()}`}
              hint={`${fmtPct(data.expenditure.confidence)} confidence`}
            />
            <StatCard
              label="Adherence"
              value={fmtPct(data.adherence.overall)}
              tone={
                data.adherence.overall >= 0.8
                  ? "good"
                  : data.adherence.overall < 0.5
                    ? "warn"
                    : "neutral"
              }
              hint={`${data.adherence.onTargetDays}/${data.adherence.totalLoggedDays} days on target`}
            />
            <StatCard
              label="Projected finish"
              value={
                data.projection?.etaWeeks != null
                  ? `${data.projection.etaWeeks.toFixed(1)} wk`
                  : "—"
              }
              hint={
                data.projection
                  ? fmtDate(data.projection.projectedDate)
                  : "no target set"
              }
            />
          </div>

          {/* Highlights */}
          {data.highlights.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.highlights.map((h) => (
                <HighlightCard key={h.id} insight={h} />
              ))}
            </div>
          ) : null}

          {/* Weekly rate chart */}
          <Panel>
            <PanelHeader
              title="Weekly trend rate"
              hint="kg change in trend weight, week over week"
            />
            <WeeklyRateChart weeks={data.weeks} />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Plateau */}
            <Panel className="lg:col-span-1">
              <PanelHeader title="Plateau watch" />
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    data.plateau.detected
                      ? "bg-white/10 text-white"
                      : "bg-white/10 text-white"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {data.plateau.detected ? (
                      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    ) : (
                      <path d="M20 6 9 17l-5-5" />
                    )}
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    {data.plateau.detected
                      ? `Stalled ${data.plateau.weeks} wk`
                      : "On track"}
                  </div>
                  <div className="text-xs text-white/40">
                    {data.plateau.message}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Adherence detail */}
            <Panel className="lg:col-span-1">
              <PanelHeader title="Consistency" />
              <div className="space-y-3">
                <Meter
                  label="On-target days"
                  value={data.adherence.overall}
                  tone={data.adherence.overall >= 0.7 ? "good" : "warn"}
                />
                <Meter
                  label="Logging rate"
                  value={data.adherence.loggingRate}
                  tone={data.adherence.loggingRate >= 0.8 ? "good" : "warn"}
                />
                <div className="pt-1 text-xs text-white/35">
                  {data.adherence.totalLoggedDays} of {data.adherence.totalDays}{" "}
                  days logged
                </div>
              </div>
            </Panel>

            {/* Projection detail */}
            <Panel className="lg:col-span-1">
              <PanelHeader title="Projection" />
              {data.projection ? (
                <dl className="space-y-2 text-sm">
                  <Row
                    k="Current trend"
                    v={`${data.projection.currentTrend.toFixed(1)} kg`}
                  />
                  <Row
                    k="Target"
                    v={`${data.projection.targetWeight.toFixed(1)} kg`}
                  />
                  <Row
                    k="Weekly rate"
                    v={fmtKg(data.projection.weeklyRate)}
                    tone={data.projection.weeklyRate < 0 ? "good" : "neutral"}
                  />
                  <Row
                    k="ETA"
                    v={
                      data.projection.etaWeeks != null
                        ? `${data.projection.etaWeeks.toFixed(1)} weeks`
                        : "not converging"
                    }
                  />
                  <Row k="Arrival" v={fmtDate(data.projection.projectedDate)} />
                </dl>
              ) : (
                <p className="text-sm text-white/40">
                  Set a goal weight to see a projected timeline.
                </p>
              )}
            </Panel>
          </div>

          {/* Weekly table */}
          <Panel>
            <PanelHeader
              title="Recent weeks"
              hint={`last ${recentWeeks.length}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-white/35">
                    <th className="pb-2 pr-4 font-medium">Week</th>
                    <th className="pb-2 pr-4 font-medium">Avg intake</th>
                    <th className="pb-2 pr-4 font-medium">Trend</th>
                    <th className="pb-2 pr-4 font-medium">Rate</th>
                    <th className="pb-2 pr-4 font-medium">Adherence</th>
                    <th className="pb-2 font-medium">Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWeeks.map((w) => (
                    <tr
                      key={w.weekStart}
                      className="border-t border-white/5 text-white/70"
                    >
                      <td className="py-2.5 pr-4 whitespace-nowrap text-white/50">
                        {w.label}
                      </td>
                      <td className="py-2.5 pr-4">
                        {w.avgIntake != null
                          ? `${w.avgIntake.toLocaleString()} kcal`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        {w.avgTrendWeight.toFixed(1)} kg
                      </td>
                      <td
                        className={`py-2.5 pr-4 ${
                          w.weeklyRate == null
                            ? "text-white/30"
                            : w.weeklyRate < 0
                              ? "text-white"
                              : "text-white/50"
                        }`}
                      >
                        {w.weeklyRate == null ? "—" : fmtKg(w.weeklyRate)}
                      </td>
                      <td className="py-2.5 pr-4">{fmtPct(w.adherence)}</td>
                      <td className="py-2.5 text-white/50">{w.daysLogged}/7</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <p className="text-center text-xs text-white/25">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- Small parts */

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn";
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="font-medium text-white/70">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${
            tone === "good" ? "bg-white" : "bg-white/40"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  tone = "neutral",
}: {
  k: string;
  v: string;
  tone?: "neutral" | "good";
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-white/40">{k}</dt>
      <dd
        className={`font-medium ${
          tone === "good" ? "text-white" : "text-white/80"
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
