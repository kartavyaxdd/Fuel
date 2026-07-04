"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CardioEntry,
  LiftEntry,
  LiftPR,
  Measurement,
  ProgressData,
  StreakStats,
} from "@nutrition/types";
import { apiGet, apiPost } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function fmt1(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(1);
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                               */
/* -------------------------------------------------------------------------- */

function StatBadge({
  label,
  value,
  unit,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const vc = "text-white";
  return (
    <Panel className="flex flex-col gap-1">
      <div className="text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div className={`text-2xl font-bold leading-none ${vc}`}>{value}</div>
      {unit ? (
        <div className="text-xs text-white/30">{unit}</div>
      ) : null}
    </Panel>
  );
}

/* ---------- Measurement delta pill ---------- */

function Delta({ cm }: { cm: number }) {
  const good = cm <= 0;
  return (
    <span
      className={`ml-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        good ? "bg-white/10 text-white" : "bg-white/[0.05] text-white/50"
      }`}
    >
      {cm > 0 ? "+" : ""}
      {cm.toFixed(1)}
    </span>
  );
}

/* ---------- Measurement card ---------- */

function MeasurementCard({ current, prev }: { current: Measurement; prev?: Measurement }) {
  const fields: { key: keyof Measurement; label: string }[] = [
    { key: "waist", label: "Waist" },
    { key: "hips", label: "Hips" },
    { key: "chest", label: "Chest" },
    { key: "armLeft", label: "Arm (L)" },
    { key: "armRight", label: "Arm (R)" },
    { key: "thigh", label: "Thigh" },
    { key: "bodyFat", label: "Body fat" },
  ];

  return (
    <Panel>
      <PanelHeader
        title="Latest measurements"
        hint={fmtDate(current.date)}
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {fields.map(({ key, label }) => {
          const val = current[key] as number | null;
          const prevVal = prev ? (prev[key] as number | null) : null;
          const delta =
            val != null && prevVal != null ? val - prevVal : null;
          const unit = key === "bodyFat" ? "%" : "cm";
          return (
            <div key={key}>
              <div className="text-xs text-white/35 uppercase tracking-wider">
                {label}
              </div>
              <div className="mt-0.5 text-lg font-semibold text-white/90">
                {val != null ? `${val.toFixed(1)} ${unit}` : "—"}
                {delta != null ? <Delta cm={delta} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------- Step trend sparkline ---------- */

function StepTrendChart({ data }: { data: { date: string; steps: number }[] }) {
  if (data.length === 0) return null;

  const W = 600;
  const H = 100;
  const pad = { t: 8, r: 12, b: 20, l: 12 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const maxSteps = Math.max(...data.map((d) => d.steps), 1);
  const minSteps = Math.min(...data.map((d) => d.steps));

  const pts = data.map((d, i) => {
    const x = pad.l + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = pad.t + (1 - (d.steps - minSteps) / (maxSteps - minSteps || 1)) * innerH;
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area =
    `M${pts[0][0]},${H - pad.b} ` +
    pts.map(([x, y]) => `L${x},${y}`).join(" ") +
    ` L${pts[pts.length - 1][0]},${H - pad.b} Z`;

  const avg = Math.round(data.reduce((s, d) => s + d.steps, 0) / data.length);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-white/35 uppercase tracking-wider">
          14-day steps
        </span>
        <span className="text-sm font-semibold text-white/70">
          {avg.toLocaleString()} avg
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full">
        <defs>
          <linearGradient id="stepGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.8)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#stepGrad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
          const [x] = pts[i];
          return (
            <text
              key={i}
              x={x}
              y={H - 4}
              textAnchor="middle"
              fontSize="9"
              className="fill-white/30"
            >
              {fmtDateShort(data[i].date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- PR table ---------- */

function PRTable({ prs }: { prs: LiftPR[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-white/35">
            <th className="pb-2 pr-4 font-medium">Exercise</th>
            <th className="pb-2 pr-4 font-medium">Weight</th>
            <th className="pb-2 pr-4 font-medium">Reps</th>
            <th className="pb-2 pr-4 font-medium">e1RM</th>
            <th className="pb-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((pr) => (
            <tr
              key={pr.exercise}
              className="border-t border-white/5 text-white/70"
            >
              <td className="py-2.5 pr-4 font-medium text-white/90">
                {pr.exercise}
              </td>
              <td className="py-2.5 pr-4">
                {pr.weightKg.toFixed(1)} kg
              </td>
              <td className="py-2.5 pr-4">{pr.reps}</td>
              <td className="py-2.5 pr-4 font-semibold text-white/70">
                {pr.oneRepMax.toFixed(1)} kg
              </td>
              <td className="py-2.5 text-white/40">
                {fmtDateShort(pr.date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Recent lifts ---------- */

function RecentLifts({ lifts }: { lifts: LiftEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? lifts : lifts.slice(0, 8);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-white/35">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Exercise</th>
              <th className="pb-2 pr-4 font-medium">Weight</th>
              <th className="pb-2 pr-4 font-medium">Reps</th>
              <th className="pb-2 font-medium">e1RM</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <tr
                key={`${l.date}-${l.exercise}-${i}`}
                className="border-t border-white/5 text-white/70"
              >
                <td className="py-2 pr-4 text-white/40">
                  {fmtDateShort(l.date)}
                </td>
                <td className="py-2 pr-4 font-medium text-white/85">
                  {l.exercise}
                </td>
                <td className="py-2 pr-4">{l.weightKg.toFixed(1)} kg</td>
                <td className="py-2 pr-4">{l.reps}</td>
                <td className="py-2 text-white/70">
                  {l.oneRepMax.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lifts.length > 8 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-white/35 hover:text-white/60 transition"
        >
          {expanded
            ? "Show less"
            : `Show ${lifts.length - 8} more`}
        </button>
      ) : null}
    </div>
  );
}

/* ---------- Cardio log ---------- */

const CARDIO_ICON: Record<string, string> = {
  run: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6v-4m0 0V8m0 4h4m-4 0H8",
  walk: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  cycle: "M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 16l4-8h6l2 4M9 8l2 8",
};

const CARDIO_COLOR: Record<string, string> = {
  run: "text-white/70",
  walk: "text-white/70",
  cycle: "text-white/70",
};

function CardioLog({ entries }: { entries: CardioEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, 6);

  return (
    <div className="space-y-2">
      {shown.map((c, i) => {
        const color = CARDIO_COLOR[c.type] ?? "text-white/70";
        return (
          <div
            key={`${c.date}-${i}`}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className={`${color} opacity-80`}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-medium capitalize text-white/85">
                  {c.type}
                </div>
                <div className="text-xs text-white/35">
                  {fmtDateShort(c.date)}
                </div>
              </div>
            </div>
            <div className="flex gap-4 text-right text-xs text-white/50">
              {c.durationMin != null ? (
                <span>
                  <span className="font-semibold text-white/80">
                    {c.durationMin}
                  </span>{" "}
                  min
                </span>
              ) : null}
              {c.kcalBurned != null ? (
                <span>
                  <span className="font-semibold text-white/80">
                    {c.kcalBurned}
                  </span>{" "}
                  kcal
                </span>
              ) : null}
              {c.steps != null ? (
                <span>
                  <span className="font-semibold text-white/80">
                    {c.steps.toLocaleString()}
                  </span>{" "}
                  steps
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      {entries.length > 6 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-white/35 hover:text-white/60 transition"
        >
          {expanded ? "Show less" : `Show ${entries.length - 6} more`}
        </button>
      ) : null}
    </div>
  );
}

/* ---------- Streak panel ---------- */

function StreakPanel({ stats }: { stats: StreakStats }) {
  const streakColor =
    stats.currentStreak >= 14
      ? "text-white"
      : stats.currentStreak >= 7
        ? "text-white/85"
        : "text-white/70";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wider text-white/35">
          Current streak
        </div>
        <div className={`text-3xl font-bold ${streakColor}`}>
          {stats.currentStreak}
          <span className="ml-1 text-base font-normal text-white/40">days</span>
        </div>
        {stats.streakStart ? (
          <div className="text-xs text-white/30">
            since {fmtDateShort(stats.streakStart)}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wider text-white/35">
          Longest streak
        </div>
        <div className="text-3xl font-bold text-white/80">
          {stats.longestStreak}
          <span className="ml-1 text-base font-normal text-white/40">days</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wider text-white/35">
          Active days
        </div>
        <div className="text-3xl font-bold text-white/80">
          {stats.totalActiveDays}
        </div>
      </div>
      {/* Flame indicator */}
      <div className="flex items-center justify-center">
        <div
          className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl ${
            stats.currentStreak > 0
              ? "bg-white/10 text-white"
              : "bg-white/[0.03] text-white/20"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="currentColor"
          >
            <path d="M12 2c0 0-4 4-4 9a4 4 0 0 0 8 0c0-5-4-9-4-9zm-1 12.5a2 2 0 1 1 2-2 2 2 0 0 1-2 2z" />
          </svg>
          <span className="mt-0.5 text-xs font-bold">
            {stats.currentStreak > 0 ? `${stats.currentStreak}d` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Measurement history mini-chart ---------- */

function MeasurementHistory({ measurements }: { measurements: Measurement[] }) {
  if (measurements.length < 2) return null;

  const hasBF = measurements.some((m) => m.bodyFat != null);

  function MiniChart({
    values,
    label,
    unit,
    colorStroke,
  }: {
    values: (number | null)[];
    label: string;
    unit: string;
    colorStroke: string;
  }) {
    const valid = values.filter((v): v is number => v != null);
    if (valid.length < 2) return null;
    const W = 600;
    const H = 100;
    const pad = { t: 8, r: 40, b: 20, l: 40 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const minV = Math.min(...valid) - 1;
    const maxV = Math.max(...valid) + 1;
    const scaleX = (i: number) =>
      pad.l + (i / (values.length - 1)) * innerW;
    const scaleY = (v: number) =>
      pad.t + (1 - (v - minV) / (maxV - minV)) * innerH;
    const pts = values.map((v, i) =>
      v != null ? ([scaleX(i), scaleY(v)] as [number, number]) : null
    );
    const validPts = pts.filter((p): p is [number, number] => p != null);
    const line = validPts.map(([x, y]) => `${x},${y}`).join(" ");
    return (
      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-white/35">{label}</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full">
          {[minV, (minV + maxV) / 2, maxV].map((v) => {
            const y = scaleY(v);
            return (
              <g key={v}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="9" className="fill-white/30">
                  {v.toFixed(0)}{unit}
                </text>
              </g>
            );
          })}
          <polyline points={line} fill="none" stroke={colorStroke} strokeWidth="2" strokeLinejoin="round" />
          {pts.map((p, i) =>
            p ? (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r="4" fill={colorStroke} opacity="0.85" />
                <text x={p[0]} y={H - 3} textAnchor="middle" fontSize="9" className="fill-white/30">
                  {fmtDateShort(measurements[i].date)}
                </text>
              </g>
            ) : null
          )}
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MiniChart
        values={measurements.map((m) => m.waist)}
        label="Waist (cm)"
        unit=""
        colorStroke="rgba(255,255,255,0.85)"
      />
      {hasBF ? (
        <MiniChart
          values={measurements.map((m) => m.bodyFat)}
          label="Body fat %"
          unit="%"
          colorStroke="rgba(255,255,255,0.5)"
        />
      ) : null}
    </div>
  );
}

/* ---------- Skeleton ---------- */

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-40 rounded-lg bg-white/5" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-48 rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                         */
/* -------------------------------------------------------------------------- */

interface MeasurementForm {
  waist: string;
  hips: string;
  chest: string;
  armLeft: string;
  neck: string;
  height: string;
}

const EMPTY_FORM: MeasurementForm = {
  waist: "", hips: "", chest: "", armLeft: "", neck: "", height: "",
};

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<MeasurementForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ProgressData>("/progress");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load progress data");
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveMeasurement(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, number> = {};
      if (form.waist) body.waist = parseFloat(form.waist);
      if (form.hips) body.hips = parseFloat(form.hips);
      if (form.chest) body.chest = parseFloat(form.chest);
      if (form.armLeft) body.armLeft = parseFloat(form.armLeft);
      if (form.neck) body.neck = parseFloat(form.neck);
      if (form.height) body.height = parseFloat(form.height);
      await apiPost("/measurements", body);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  // Derived
  const prevMeasurement = useMemo(
    () => (data && data.measurements.length >= 2
      ? data.measurements[data.measurements.length - 2]
      : undefined),
    [data],
  );

  const cardioSummary = useMemo(() => {
    if (!data) return null;
    const total = data.recentCardio.reduce(
      (s, c) => ({
        kcal: s.kcal + (c.kcalBurned ?? 0),
        min: s.min + (c.durationMin ?? 0),
        sessions: s.sessions + 1,
      }),
      { kcal: 0, min: 0, sessions: 0 },
    );
    return total;
  }, [data]);

  if (loading && !data) return <Skeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Progress
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Measurements, strength PRs, and activity — the long game.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          {/* ── Log measurement ── */}
          <Panel>
            <div className="flex items-center justify-between">
              <PanelHeader title="Body measurements" hint="Track waist, hips, chest, arms" />
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                {formOpen ? "Cancel" : "+ Log"}
              </button>
            </div>
            {formOpen ? (
              <form onSubmit={saveMeasurement} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(
                    [
                      { key: "waist", label: "Waist (cm)" },
                      { key: "hips", label: "Hips (cm)" },
                      { key: "chest", label: "Chest (cm)" },
                      { key: "armLeft", label: "Arm (cm)" },
                      { key: "neck", label: "Neck (cm) *" },
                      { key: "height", label: "Height (cm) *" },
                    ] as { key: keyof MeasurementForm; label: string }[]
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-white/40 mb-1">{label}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder="—"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 focus:ring-0"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/30">* Neck + Height auto-calculate BF% via Navy formula</p>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save measurements"}
                </button>
              </form>
            ) : null}
          </Panel>

          {/* ── Streak panel ── */}
          <Panel>
            <PanelHeader title="Activity streaks" />
            <StreakPanel stats={data.streaks} />
          </Panel>

          {/* ── Top stat cards ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatBadge
              label="Body fat"
              value={fmt1(data.latestMeasurement?.bodyFat)}
              unit="%"
              tone={
                data.latestMeasurement?.bodyFat != null &&
                data.latestMeasurement.bodyFat < 20
                  ? "good"
                  : "neutral"
              }
            />
            <StatBadge
              label="Waist"
              value={fmt1(data.latestMeasurement?.waist)}
              unit="cm"
            />
            <StatBadge
              label="Cardio sessions"
              value={String(cardioSummary?.sessions ?? "—")}
              unit="recent sessions"
              tone="good"
            />
            <StatBadge
              label="Cardio burned"
              value={
                cardioSummary
                  ? cardioSummary.kcal.toLocaleString()
                  : "—"
              }
              unit="kcal total"
              tone="good"
            />
          </div>

          {/* ── Measurements ── */}
          {data.latestMeasurement ? (
            <MeasurementCard
              current={data.latestMeasurement}
              prev={prevMeasurement}
            />
          ) : null}

          {/* ── Measurement history chart ── */}
          {data.measurements.length >= 2 ? (
            <Panel>
              <PanelHeader
                title="Measurement history"
                hint={`${data.measurements.length} snapshots`}
              />
              <MeasurementHistory measurements={data.measurements} />
            </Panel>
          ) : null}

          {/* ── Strength PRs + Steps ── */}
          <div className="grid gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3">
              <PanelHeader
                title="Strength PRs"
                hint="Epley estimated 1-rep max"
              />
              <PRTable prs={data.prs} />
            </Panel>

            <Panel className="lg:col-span-2">
              <PanelHeader title="Daily steps" />
              <StepTrendChart data={data.stepTrend} />
            </Panel>
          </div>

          {/* ── Recent lifts ── */}
          <Panel>
            <PanelHeader
              title="Recent lifts"
              hint="last 30 entries"
            />
            <RecentLifts lifts={data.recentLifts} />
          </Panel>

          {/* ── Cardio ── */}
          <Panel>
            <PanelHeader
              title="Recent cardio"
              hint={`${cardioSummary?.sessions ?? 0} sessions · ${cardioSummary?.min ?? 0} min`}
            />
            <CardioLog entries={data.recentCardio} />
          </Panel>

          <p className="text-center text-xs text-white/25">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </div>
  );
}
