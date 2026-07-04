"use client";

import { useEffect, useState } from "react";
import type { GoalMode, SetGoalRequest, UserGoal } from "@nutrition/types";
import { apiGet, apiPost } from "@/lib/api";

const MODES: { value: GoalMode; label: string; blurb: string }[] = [
  { value: "fat-loss", label: "Cut", blurb: "Lose fat, hold muscle" },
  { value: "recomp", label: "Recomp", blurb: "Fat down, muscle up simultaneously" },
  { value: "maintenance", label: "Maintain", blurb: "Hold current physique" },
  { value: "lean-bulk", label: "Lean Bulk", blurb: "Slow, clean mass gains" },
];

export function GoalSetupModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (goal: UserGoal) => void;
}) {
  const [mode, setMode] = useState<GoalMode>("fat-loss");
  const [targetWeight, setTargetWeight] = useState("");
  const [startWeight, setStartWeight] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetBodyFat, setTargetBodyFat] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    apiGet<UserGoal>("/goal")
      .then((g) => {
        if (!alive) return;
        setMode(g.mode);
        setTargetWeight(String(g.targetWeight));
        setStartWeight(String(g.startWeight));
        setStartDate(g.startDate);
        setTargetBodyFat(g.targetBodyFat != null ? String(g.targetBodyFat) : "");
        setHeight(g.height != null ? String(g.height) : "");
        setSex(g.sex ?? "male");
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load goal"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open]);

  if (!open) return null;

  async function save() {
    const tw = Number(targetWeight);
    if (!Number.isFinite(tw) || tw <= 0) {
      setError("Enter a valid target weight.");
      return;
    }
    setSaving(true);
    setError(null);
    const body: SetGoalRequest = {
      mode,
      targetWeight: tw,
      startWeight: startWeight ? Number(startWeight) : undefined,
      startDate: startDate || undefined,
      sex,
    };
    if (targetBodyFat) body.targetBodyFat = Number(targetBodyFat);
    if (height) body.height = Number(height);
    try {
      const saved = await apiPost<UserGoal>("/goal", body);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/95 p-6 shadow-2xl backdrop-blur-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Set your goal</h2>
            <p className="mt-1 text-sm text-white/40">
              Pick a mode and a target. The coach holds you to it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full px-2 text-white/40 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Goal mode */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      mode === m.value
                        ? "border-white/40 bg-white/[0.10]"
                        : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{m.label}</div>
                    <div className="text-[11px] text-white/40">{m.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Weight targets */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target weight (kg)" value={targetWeight} onChange={setTargetWeight} type="number" placeholder="75" />
              <Field label="Start weight (kg)" value={startWeight} onChange={setStartWeight} type="number" placeholder="84" />
            </div>

            <Field label="Start date" value={startDate} onChange={setStartDate} type="date" />

            {/* Aesthetic physique section */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Aesthetic physique (optional)
              </div>
              <p className="text-xs text-white/30">
                Target BF%, height, and sex unlock auto BF% calculation and precise coach feedback.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Target BF%" value={targetBodyFat} onChange={setTargetBodyFat} type="number" placeholder="12" />
                <Field label="Height (cm)" value={height} onChange={setHeight} type="number" placeholder="178" />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Sex</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["male", "female"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSex(s)}
                      className={`rounded-xl border py-2 text-sm font-medium capitalize transition ${
                        sex === s
                          ? "border-white/40 bg-white/[0.10] text-white"
                          : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save goal"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/30"
      />
    </div>
  );
}
