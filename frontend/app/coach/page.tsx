"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CoachData,
  CoachRecommendation,
  CoachTone,
  GoalMode,
  ChatMessage,
} from "@nutrition/types";
import { apiGet } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";

/* ------------------------------------------------ SSE progress event types */

type ProgressEvent =
  | { type: "thinking" }
  | { type: "searching"; query: string }
  | { type: "found"; name: string; calories: number; protein: number; carbs: number; fat: number }
  | { type: "logging"; name: string; slot: string; quantity: number }
  | { type: "logged"; name: string; slot: string; calories: number; protein: number; carbs: number; fat: number }
  | { type: "error"; message: string }
  | { type: "reply"; text: string }
  | { type: "done" };

const MODES: { value: GoalMode; label: string }[] = [
  { value: "fat-loss", label: "Fat loss" },
  { value: "maintenance", label: "Maintain" },
  { value: "lean-bulk", label: "Lean bulk" },
  { value: "recomp", label: "Recomp" },
];

function fmtKg(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)} kg`;
}

function fmtKcal(n: number | null): string {
  return n == null ? "—" : `${Math.round(n).toLocaleString()}`;
}

function fmtSigned(n: number): string {
  return `${n > 0 ? "+" : ""}${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/* ----------------------------------------------------------- Tone → styling */

const TONE_STYLE: Record<
  CoachTone,
  { ring: string; chip: string; icon: string; glyph: string }
> = {
  positive: {
    ring: "border-white/10 bg-white/[0.04]",
    chip: "bg-white/10 text-white/80",
    icon: "text-white/80",
    glyph: "M20 6 9 17l-5-5",
  },
  neutral: {
    ring: "border-white/10 bg-white/[0.04]",
    chip: "bg-white/10 text-white/80",
    icon: "text-white/80",
    glyph: "M12 16v-4M12 8h.01",
  },
  warning: {
    ring: "border-white/10 bg-white/[0.04]",
    chip: "bg-white/10 text-white/80",
    icon: "text-white/80",
    glyph:
      "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  },
  action: {
    ring: "border-white/10 bg-white/[0.04]",
    chip: "bg-white/10 text-white/80",
    icon: "text-white/80",
    glyph: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z",
  },
};

const CATEGORY_LABEL: Record<CoachRecommendation["category"], string> = {
  calories: "Calories",
  macros: "Macros",
  activity: "Activity",
  adherence: "Adherence",
  recovery: "Recovery",
};

/* ---------------------------------------------------------------- Mode toggle */

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

/* ------------------------------------------------------------- Confidence ring */

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const stroke =
    pct >= 0.75
      ? "rgba(255,255,255,0.9)"
      : pct >= 0.5
        ? "rgba(255,255,255,0.6)"
        : "rgba(255,255,255,0.35)";
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white/90">{fmtPct(pct)}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Macro split */

function MacroBar({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const pKcal = protein * 4;
  const cKcal = carbs * 4;
  const fKcal = fat * 9;
  const total = Math.max(1, pKcal + cKcal + fKcal);
  const seg = [
    { label: "Protein", grams: protein, kcal: pKcal, color: "rgba(255,255,255,0.85)" },
    { label: "Carbs", grams: carbs, kcal: cKcal, color: "rgba(255,255,255,0.55)" },
    { label: "Fat", grams: fat, kcal: fKcal, color: "rgba(255,255,255,0.3)" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {seg.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.kcal / total) * 100}%`, backgroundColor: s.color }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {seg.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-white/40">{s.label}</span>
            </div>
            <span className="text-lg font-bold text-white">{s.grams}g</span>
            <span className="text-[11px] text-white/30">
              {Math.round((s.kcal / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Recommendation card */

function RecommendationCard({ rec }: { rec: CoachRecommendation }) {
  const s = TONE_STYLE[rec.tone];
  return (
    <div className={`rounded-2xl border p-5 ${s.ring}`}>
      <div className="mb-3 flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.chip}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={s.glyph} />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white/90">{rec.title}</h3>
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/30">
            {CATEGORY_LABEL[rec.category]}
          </span>
        </div>
        {rec.delta ? (
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${s.chip}`}
          >
            {fmtSigned(rec.delta.value)} {rec.delta.unit}
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-sm leading-relaxed text-white/50">{rec.rationale}</p>
      <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
        <svg
          viewBox="0 0 24 24"
          className={`mt-0.5 h-4 w-4 shrink-0 ${s.icon}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <p className="text-sm font-medium text-white/75">{rec.action}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Skeleton */

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 w-48 rounded-lg bg-white/5" />
      <div className="h-40 rounded-2xl bg-white/5" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl bg-white/5" />
        <div className="h-56 rounded-2xl bg-white/5" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Small parts */

function Stat({
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
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-white/35">
        {label}
      </span>
      <span className={`text-xl font-bold ${toneClass}`}>{value}</span>
      {hint ? <span className="text-[11px] text-white/30">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------- Status card (SSE) */

const STATUS_META: Record<string, { icon: string; label: (e: ProgressEvent) => string; pulse?: boolean }> = {
  thinking: {
    icon: "✦",
    label: () => "Coach is thinking…",
    pulse: true,
  },
  searching: {
    icon: "⌕",
    label: (e) => `Searching food database for "${(e as { type: "searching"; query: string }).query}"…`,
    pulse: true,
  },
  found: {
    icon: "◎",
    label: (e) => {
      const ev = e as { type: "found"; name: string; calories: number };
      return `Found: ${ev.name} · ${ev.calories} kcal/serving`;
    },
  },
  logging: {
    icon: "⊕",
    label: (e) => {
      const ev = e as { type: "logging"; name: string; slot: string; quantity: number };
      return `Adding ${ev.quantity}× ${ev.name} to ${ev.slot}…`;
    },
    pulse: true,
  },
  logged: {
    icon: "✓",
    label: (e) => {
      const ev = e as { type: "logged"; name: string; slot: string; calories: number; protein: number; carbs: number; fat: number };
      return `Logged to ${ev.slot}: ${ev.name} · ${ev.calories} kcal · P${ev.protein}g C${ev.carbs}g F${ev.fat}g`;
    },
  },
  error: {
    icon: "✕",
    label: (e) => (e as { type: "error"; message: string }).message,
  },
};

function StatusCard({ event, active }: { event: ProgressEvent; active: boolean }) {
  const meta = STATUS_META[event.type];
  if (!meta) return null;
  const isError = event.type === "error";
  const isSuccess = event.type === "logged" || event.type === "found";

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-300 ${
        isError
          ? "border-red-500/20 bg-red-500/[0.06] text-red-300/80"
          : isSuccess
          ? "border-white/10 bg-white/[0.05] text-white/80"
          : "border-white/[0.06] bg-white/[0.03] text-white/50"
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 text-base font-bold leading-none ${
          isError ? "text-red-400" : isSuccess ? "text-white/90" : "text-white/40"
        } ${active && meta.pulse ? "animate-pulse" : ""}`}
      >
        {meta.icon}
      </span>
      <span className="text-xs leading-relaxed">{meta.label(event)}</span>
      {event.type === "logged" && (
        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          Added
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- Page */

export default function CoachPage() {
  const [data, setData] = useState<CoachData | null>(null);
  const [mode, setMode] = useState<GoalMode>("fat-loss");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: GoalMode) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<CoachData>(`/coach?mode=${m}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load coach");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(mode);
  }, [load, mode]);

  // Chat state — persisted to localStorage
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("fuel_chat_history");
      if (stored) return JSON.parse(stored) as ChatMessage[];
    } catch {}
    return [];
  });
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [statusEvents, setStatusEvents] = useState<ProgressEvent[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

  // Persist chat history whenever it changes
  useEffect(() => {
    try {
      // Keep last 40 messages to avoid blowing up localStorage
      const trimmed = chatMessages.slice(-40);
      localStorage.setItem("fuel_chat_history", JSON.stringify(trimmed));
    } catch {}
  }, [chatMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading, statusEvents]);

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", text: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);
    setChatError(null);
    setStatusEvents([]);
    const input = chatInput;
    setChatInput("");

    try {
      const res = await fetch(`${API_BASE}/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, sessionHistory: chatMessages }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const raw = trimmed.slice(5).trim();
          try {
            const event: ProgressEvent = JSON.parse(raw);
            if (event.type === "reply") {
              const modelMsg: ChatMessage = { role: "model", text: event.text };
              setChatMessages((prev) => [...prev, modelMsg]);
              setStatusEvents([]);
            } else if (event.type === "done") {
              // nothing
            } else if (event.type === "error") {
              setChatError(event.message);
            } else {
              setStatusEvents((prev) => [...prev, event]);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      setChatError(msg);
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
      setStatusEvents([]);
    }
  }, [chatInput, chatLoading, chatMessages, API_BASE]);

  if (loading && !data) {
    return <Skeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AI Coach</h1>
          <p className="mt-1 text-sm text-white/40">
            A grounded briefing from your own numbers — not a chatbot guessing.
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
          {/* Hero briefing */}
          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.03] blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Today&apos;s read
                </span>
                <h2 className="mt-1 text-xl font-bold leading-snug text-white">
                  {data.headline}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  {data.summary}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <ConfidenceRing value={data.confidence} />
                <span className="text-[11px] text-white/30">confidence</span>
              </div>
            </div>

            {/* Focus lever */}
            <div className="relative mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-5 w-5 shrink-0 text-white/70"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
              </svg>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Biggest lever right now
                </div>
                <p className="mt-0.5 text-sm font-medium text-white/85">{data.focus}</p>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Check-in retrospective */}
            <Panel>
              <PanelHeader title="Check-in" hint={data.checkIn.periodLabel} />
              <p className="mb-4 text-sm leading-relaxed text-white/55">
                {data.checkIn.verdict}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Stat
                  label="Avg intake"
                  value={fmtKcal(data.checkIn.avgIntake)}
                  hint="kcal / day"
                />
                <Stat
                  label="Avg expenditure"
                  value={fmtKcal(data.checkIn.avgExpenditure)}
                  hint="kcal / day"
                />
                <Stat
                  label="Energy balance"
                  value={
                    data.checkIn.energyBalance == null
                      ? "—"
                      : fmtSigned(data.checkIn.energyBalance)
                  }
                  tone={
                    data.checkIn.energyBalance == null
                      ? "neutral"
                      : data.checkIn.energyBalance < 0
                        ? "good"
                        : "warn"
                  }
                  hint="kcal / day"
                />
                <Stat
                  label="Trend change"
                  value={fmtKg(data.checkIn.weightTrendDelta)}
                  tone={data.checkIn.weightTrendDelta < 0 ? "good" : "neutral"}
                  hint="over window"
                />
              </div>
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-white/50">Adherence</span>
                  <span className="font-medium text-white/70">
                    {fmtPct(data.checkIn.adherence)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${
                      data.checkIn.adherence >= 0.7 ? "bg-white" : "bg-white/40"
                    }`}
                    style={{ width: `${Math.round(data.checkIn.adherence * 100)}%` }}
                  />
                </div>
              </div>
            </Panel>

            {/* Targets */}
            <Panel>
              <PanelHeader title="Recommended targets" />
              <div className="mb-5 flex items-end gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-white/35">
                    Daily calories
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">
                      {data.targets.recommended.toLocaleString()}
                    </span>
                    <span className="text-sm text-white/40">kcal</span>
                  </div>
                </div>
                {data.targets.delta !== 0 ? (
                  <span
                    className={`mb-1 rounded-lg px-2 py-1 text-xs font-bold ${
                      data.targets.delta < 0
                        ? "bg-white/10 text-white"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {fmtSigned(data.targets.delta)} vs{" "}
                    {data.targets.current.toLocaleString()}
                  </span>
                ) : (
                  <span className="mb-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-white/50">
                    holding steady
                  </span>
                )}
              </div>
              <MacroBar
                protein={data.targets.protein}
                carbs={data.targets.carbs}
                fat={data.targets.fat}
              />
              <p className="mt-4 text-xs leading-relaxed text-white/40">
                {data.targets.rationale}
              </p>
            </Panel>
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
                  Action plan
                </h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40">
                  {data.recommendations.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {data.recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Talking points */}
          {data.talkingPoints.length > 0 ? (
            <Panel>
              <PanelHeader title="Before your next check-in" hint="reflect on these" />
              <ul className="space-y-2.5">
                {data.talkingPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-white/40">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-white/60">{point}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {/* Brutal AI Coach Chat */}
          <Panel className="mt-6">
            <div className="flex items-center justify-between mb-1">
              <PanelHeader title="Brutal Coach" hint="chat — no coddling" />
              {chatMessages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setChatMessages([]);
                    localStorage.removeItem("fuel_chat_history");
                  }}
                  className="text-xs text-white/30 hover:text-white/60 transition"
                >
                  Clear chat
                </button>
              ) : null}
            </div>
            {chatError ? (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {chatError}
              </div>
            ) : null}

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {chatMessages.length === 0 && !chatLoading ? (
                <p className="text-sm text-white/40 text-center py-8">
                  Ask anything — macros, logging food, why you&apos;re stuck.<br />
                  Try: <span className="text-white/60">&quot;Log 2 eggs for breakfast&quot;</span>
                </p>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-white/10 text-white rounded-br-none"
                          : "bg-white/[0.06] text-white/90 rounded-bl-none"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}

                  {/* Live status cards while loading */}
                  {chatLoading && (
                    <div className="space-y-2">
                      {statusEvents.length === 0 && (
                        <StatusCard event={{ type: "thinking" }} active />
                      )}
                      {statusEvents.map((evt, i) => (
                        <StatusCard key={i} event={evt} active={i === statusEvents.length - 1} />
                      ))}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={chatLoading}
                placeholder={chatLoading ? "Coach is working…" : "Message your coach…"}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {chatLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:240ms]" />
                  </span>
                ) : "Send"}
              </button>
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
