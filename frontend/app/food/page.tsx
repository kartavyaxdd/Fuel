"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FoodDay,
  FoodItem,
  FoodSearchResult,
  MacroTarget,
  MealGroup,
  MealSlot,
} from "@nutrition/types";
import { MEAL_SLOTS } from "@nutrition/types";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { CalorieRing } from "@/components/CalorieRing";
import { MacroBar } from "@/components/MacroBar";
import { Panel, PanelHeader } from "@/components/ui/Panel";

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const SLOT_ICON: Record<MealSlot, string> = {
  breakfast: "M3 12h18M12 3v0M6 8s1-2 6-2 6 2 6 2",
  lunch: "M4 11h16M6 7h12M8 15h8",
  dinner: "M12 3v18M5 8h14",
  snack: "M5 12h14M8 8h8M9 16h6",
};

/** Shift a YYYY-MM-DD date string by whole days, staying in UTC so we never
 *  drift across DST/timezone boundaries. Returns YYYY-MM-DD. */
function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function prettyDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Today" / "Yesterday" / "Tomorrow" relative to the app's today, else null. */
function relativeDayLabel(date: string, today: string): string | null {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  if (date === addDays(today, 1)) return "Tomorrow";
  return null;
}

export default function FoodPage() {
  const [day, setDay] = useState<FoodDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingSlot, setAddingSlot] = useState<MealSlot | null>(null);
  // The very first load (no date param) resolves to the app's "today"; we
  // remember it so the date nav can offer a "Today" jump and disable "next".
  const [today, setToday] = useState<string | null>(null);

  const load = useCallback(async (targetDate?: string) => {
    try {
      const path = targetDate
        ? `/food/day?date=${encodeURIComponent(targetDate)}`
        : "/food/day";
      const d = await apiGet<FoodDay>(path);
      setDay(d);
      setToday((prev) => prev ?? d.date);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const goToDate = useCallback(
    (targetDate: string) => {
      setDay(null); // show skeleton while the new day loads
      load(targetDate);
    },
    [load],
  );

  const copyYesterday = useCallback(async () => {
    if (!day) return;
    setBusy(true);
    try {
      const from = addDays(day.date, -1);
      const updated = await apiPost<FoodDay>("/food/copy", {
        from,
        to: day.date,
      });
      setDay(updated);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy yesterday");
    } finally {
      setBusy(false);
    }
  }, [day]);

  const logFood = useCallback(
    async (slot: MealSlot, foodId: string, quantity: number) => {
      if (!day) return;
      setBusy(true);
      try {
        const updated = await apiPost<FoodDay>("/food/log", {
          date: day.date,
          slot,
          foodId,
          quantity,
        });
        setDay(updated);
        setAddingSlot(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to log food");
      } finally {
        setBusy(false);
      }
    },
    [day],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      if (!day) return;
      setBusy(true);
      try {
        const updated = await apiDelete<FoodDay>(
          `/food/log/${id}?date=${encodeURIComponent(day.date)}`,
        );
        setDay(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove entry");
      } finally {
        setBusy(false);
      }
    },
    [day],
  );

  if (error && !day) return <ErrorState message={error} />;
  if (!day) return <SkeletonState />;

  const isToday = today != null && day.date === today;
  const relLabel = today ? relativeDayLabel(day.date, today) : null;
  const isEmptyDay = day.groups.every((g) => g.entries.length === 0);

  const macroTarget = (key: "protein" | "carbs" | "fat"): MacroTarget => ({
    target: day.target[key],
    consumed: day.consumed[key],
    remaining: day.remaining[key],
  });

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white/40">
              {relLabel ?? prettyDate(day.date)}
            </p>
            {relLabel ? (
              <span className="text-xs text-white/30">{prettyDate(day.date)}</span>
            ) : null}
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Food Log
          </h1>
        </div>
        <div className="flex items-end gap-4">
          <DateNav
            date={day.date}
            canGoNext={!isToday}
            showToday={!isToday}
            disabled={busy}
            onPrev={() => goToDate(addDays(day.date, -1))}
            onNext={() => goToDate(addDays(day.date, 1))}
            onToday={() => today && goToDate(today)}
          />
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-white">
              {Math.max(day.remaining.calories, 0)}
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40">
              kcal left
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Hero summary */}
        <Panel className="lg:col-span-3">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
            <CalorieRing
              consumed={day.consumed.calories}
              target={day.target.calories}
              remaining={day.remaining.calories}
            />
            <div className="grid w-full flex-1 gap-3 sm:grid-cols-3">
              <MacroBar label="Protein" macro={macroTarget("protein")} accent="protein" />
              <MacroBar label="Carbs" macro={macroTarget("carbs")} accent="carbs" />
              <MacroBar label="Fat" macro={macroTarget("fat")} accent="fat" />
            </div>
          </div>
        </Panel>

        {/* Copy-yesterday shortcut on an empty day */}
        {isEmptyDay ? (
          <div className="lg:col-span-3">
            <button
              type="button"
              onClick={copyYesterday}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-3 text-sm font-medium text-white/60 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
              >
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
              {busy ? "Copying…" : "Copy yesterday's meals"}
            </button>
          </div>
        ) : null}

        {/* Meal groups */}
        {day.groups.map((group) => (
          <MealSection
            key={group.slot}
            group={group}
            busy={busy}
            onAdd={() => setAddingSlot(group.slot)}
            onRemove={removeEntry}
          />
        ))}
      </div>

      {error && day ? (
        <p className="mt-6 text-center text-sm text-red-400/80">{error}</p>
      ) : null}

      {addingSlot ? (
        <AddFoodSheet
          slot={addingSlot}
          busy={busy}
          onClose={() => setAddingSlot(null)}
          onLog={logFood}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Date navigation                                                     */
/* ------------------------------------------------------------------ */

function DateNav({
  canGoNext,
  showToday,
  disabled,
  onPrev,
  onNext,
  onToday,
}: {
  date: string;
  canGoNext: boolean;
  showToday: boolean;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Previous day"
        onClick={onPrev}
        disabled={disabled}
        className={arrow}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      {showToday ? (
        <button
          type="button"
          onClick={onToday}
          disabled={disabled}
          className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          Today
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Next day"
        onClick={onNext}
        disabled={disabled || !canGoNext}
        className={arrow}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Meal section                                                        */
/* ------------------------------------------------------------------ */

function MealSection({
  group,
  busy,
  onAdd,
  onRemove,
}: {
  group: MealGroup;
  busy: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Panel className="lg:col-span-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d={SLOT_ICON[group.slot]} />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">{group.label}</h2>
            <p className="text-xs text-white/40">
              {group.totals.calories} kcal · {group.totals.protein}p ·{" "}
              {group.totals.carbs}c · {group.totals.fat}f
            </p>
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
        </button>
      </div>

      {group.entries.length === 0 ? (
        <button
          onClick={onAdd}
          className="mt-3 w-full rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-white/30 transition hover:border-white/20 hover:text-white/50"
        >
          Nothing here yet — tap to add {group.label.toLowerCase()}.
        </button>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {group.entries.map((e) => (
            <li key={e.id} className="group flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-white">
                  {e.name}
                  {e.brand ? (
                    <span className="ml-2 text-xs font-normal text-white/30">
                      {e.brand}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-white/40">
                  {formatQty(e.quantity)} × {e.servingUnit} · {e.protein}p ·{" "}
                  {e.carbs}c · {e.fat}f
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums text-white/80">
                  {e.calories}
                </span>
                <button
                  onClick={() => onRemove(e.id)}
                  disabled={busy}
                  aria-label={`Remove ${e.name}`}
                  className="rounded-md p-1 text-white/20 opacity-0 transition hover:bg-white/5 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                    <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Add-food sheet (search + quantity)                                  */
/* ------------------------------------------------------------------ */

interface RecentFood {
  foodId: string;
  name: string;
  count: number;
  lastDate: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function AddFoodSheet({
  slot,
  busy,
  onClose,
  onLog,
}: {
  slot: MealSlot;
  busy: boolean;
  onClose: () => void;
  onLog: (slot: MealSlot, foodId: string, quantity: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    apiGet<{ items: RecentFood[] }>("/food/recent?limit=8")
      .then((r) => setRecentFoods(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      apiGet<FoodSearchResult>(`/food/search?q=${encodeURIComponent(q)}&limit=20`)
        .then((r) => alive && setResults(r.items))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const preview = useMemo(() => {
    if (!selected) return null;
    return {
      calories: Math.round(selected.calories * quantity),
      protein: round1(selected.protein * quantity),
      carbs: round1(selected.carbs * quantity),
      fat: round1(selected.fat * quantity),
    };
  }, [selected, quantity]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-2xl sm:rounded-3xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">
              Add to {SLOT_LABELS[slot]}
            </p>
            <h3 className="text-lg font-semibold text-white">
              {selected ? selected.name : "Search foods"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {selected ? (
          <div className="p-5">
            <button
              onClick={() => setSelected(null)}
              className="mb-4 flex items-center gap-1 text-xs text-white/40 transition hover:text-white/70"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back to search
            </button>

            {selected.brand ? (
              <p className="text-sm text-white/40">{selected.brand}</p>
            ) : null}
            <p className="text-sm text-white/50">
              Per {selected.servingSize} {selected.servingUnit} · {selected.calories} kcal
            </p>

            <div className="mt-5">
              <label className="mb-2 block text-xs uppercase tracking-wider text-white/40">
                Servings
              </label>
              <div className="flex items-center gap-3">
                <StepButton onClick={() => setQuantity((q) => round1(Math.max(0.25, q - 0.25)))} label="−" />
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={quantity}
                  onChange={(ev) => setQuantity(clampQty(Number(ev.target.value)))}
                  className="w-24 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-lg font-semibold tabular-nums text-white outline-none focus:border-white/20"
                />
                <StepButton onClick={() => setQuantity((q) => round1(q + 0.25))} label="+" />
              </div>
            </div>

            {preview ? (
              <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center">
                <PreviewStat label="kcal" value={preview.calories} />
                <PreviewStat label="protein" value={`${preview.protein}g`} />
                <PreviewStat label="carbs" value={`${preview.carbs}g`} />
                <PreviewStat label="fat" value={`${preview.fat}g`} />
              </div>
            ) : null}

            <button
              onClick={() => onLog(slot, selected.id, quantity)}
              disabled={busy}
              className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90 disabled:opacity-50"
            >
              {busy ? "Adding…" : `Add to ${SLOT_LABELS[slot]}`}
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 focus-within:border-white/20">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  placeholder="Search chicken, oats, whey…"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-3">
              {loading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
                  ))}
                </div>
              ) : query.trim() && results.length === 0 ? (
                <div className="py-12 text-center text-sm text-white/30">
                  No matches for “{query.trim()}”.
                </div>
              ) : !query.trim() ? (
                recentFoods.length > 0 ? (
                  <div>
                    <p className="px-2 pb-2 text-xs uppercase tracking-wider text-white/30">
                      Recent
                    </p>
                    <ul className="space-y-1">
                      {recentFoods.map((item) => (
                        <li key={item.foodId}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected({
                                id: item.foodId,
                                name: item.name,
                                brand: undefined,
                                calories: item.calories,
                                protein: item.protein,
                                carbs: item.carbs,
                                fat: item.fat,
                                servingSize: 100,
                                servingUnit: "g",
                                source: "database" as const,
                              });
                              setQuantity(1);
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white">{item.name}</div>
                              <div className="truncate text-xs text-white/40">
                                {item.count}× logged · {item.protein}p · {item.carbs}c · {item.fat}f
                              </div>
                            </div>
                            <span className="ml-3 shrink-0 text-sm font-semibold tabular-nums text-white/70">
                              {item.calories}
                              <span className="text-xs font-normal text-white/30"> kcal</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 px-2 text-xs text-white/20">Or search above for more foods</p>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-white/30">
                    Start typing to search the food database.
                  </div>
                )
              ) : (
                <ul className="space-y-1">
                  {results.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setSelected(item);
                          setQuantity(1);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate font-medium text-white">{item.name}</span>
                            {sourceLabel(item.id) ? (
                              <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide border border-white/10 ${sourceLabel(item.id)!.cls}`}>
                                {sourceLabel(item.id)!.text}
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-white/40">
                            {item.brand ? `${item.brand} · ` : ""}
                            {item.servingSize} {item.servingUnit} · {item.protein}p ·{" "}
                            {item.carbs}c · {item.fat}f
                          </div>
                        </div>
                        <span className="ml-3 shrink-0 text-sm font-semibold tabular-nums text-white/70">
                          {item.calories}
                          <span className="text-xs font-normal text-white/30"> kcal</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function StepButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xl font-semibold text-white/70 transition hover:bg-white/[0.08]"
    >
      {label}
    </button>
  );
}

function PreviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-base font-bold tabular-nums text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}

function sourceLabel(id: string): { text: string; cls: string } | null {
  if (id.startsWith("off-")) return { text: "OFF", cls: "text-white/30" };
  if (id.startsWith("usda-")) return { text: "USDA", cls: "text-white/30" };
  if (id.startsWith("sp-")) return { text: "Spoon", cls: "text-white/30" };
  if (id.startsWith("in-")) return { text: "Indian", cls: "text-white/30" };
  return null;
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampQty(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0.25;
  return round1(n);
}

function SkeletonState() {
  return (
    <div>
      <div className="mb-8 h-10 w-40 animate-pulse rounded-lg bg-white/5" />
      <div className="grid grid-cols-1 gap-5">
        <div className="h-56 animate-pulse rounded-2xl bg-white/5" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 text-4xl">⚠️</div>
      <h1 className="text-lg font-semibold text-white">Couldn&apos;t load your food log</h1>
      <p className="mt-2 text-sm text-white/40">{message}</p>
      <p className="mt-4 text-xs text-white/30">
        Make sure the API is running on port 3001.
      </p>
    </div>
  );
}
