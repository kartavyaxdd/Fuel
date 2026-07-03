import { supabase, supabaseEnabled } from '../db';

/**
 * Persistence layer — stores domain snapshots in Supabase.
 *
 * Domain stores (foodLog, weight, …) register a named snapshot provider via
 * `registerStore()`. On boot the server calls `loadAll()` to rehydrate every
 * provider from Supabase; after each mutation a provider calls
 * `scheduleSave()`, which debounces a single upsert of all providers.
 *
 * When Supabase env vars are missing the app runs in-memory only (good for
 * local dev / test).  Under NODE_ENV=test persistence is disabled entirely.
 */

const ENABLED = process.env.NODE_ENV !== 'test' && supabaseEnabled;

interface Provider {
  name: string;
  export: () => unknown;
  import: (data: unknown) => void;
}

const providers = new Map<string, Provider>();

// Tracks the most recently dispatched write so flushNow() can await it.
let lastWrite: Promise<void> = Promise.resolve();

/** Register a domain store's snapshot provider. Called at module load. */
export function registerStore(
  name: string,
  exportFn: () => unknown,
  importFn: (data: unknown) => void,
): void {
  providers.set(name, { name, export: exportFn, import: importFn });
}

/** Rehydrate every registered provider from Supabase. */
export async function loadAll(): Promise<void> {
  if (!ENABLED || !supabase) return;
  const { data, error } = await supabase.from('store').select('key, value');
  if (error) {
    console.error('[store] loadAll query failed:', error.message);
    return;
  }
  const loaded = new Map((data ?? []).map(r => [r.key, r.value]));
  for (const provider of providers.values()) {
    const value = loaded.get(provider.name);
    try {
      provider.import(value ?? {});
    } catch (err) {
      console.error(`[store] failed to import "${provider.name}":`, err);
    }
  }
}

/** Persist all providers to Supabase in a single upsert batch. */
async function persistNow(): Promise<void> {
  if (!ENABLED || !supabase) return;
  const rows = [...providers.entries()].map(([key, p]) => ({
    key,
    value: JSON.stringify(p.export()),
  }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('store')
    .upsert(rows, { onConflict: 'key', ignoreDuplicates: false });
  if (error) {
    console.error('[store] persist failed:', error.message);
  }
}

const SAVE_DEBOUNCE_MS = 400;
let timer: NodeJS.Timeout | null = null;

/** Debounced persist — coalesces bursts of mutations into one upsert batch. */
export function scheduleSave(): void {
  if (!ENABLED) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    lastWrite = persistNow();
    lastWrite.catch(() => {});
  }, SAVE_DEBOUNCE_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

/** Delete all rows so next boot uses fresh seed data. */
export async function resetStore(): Promise<void> {
  if (!ENABLED || !supabase) return;
  const { error } = await supabase.from('store').delete().neq('key', '');
  if (error) console.error('[store] reset failed:', error.message);
}

/** Flush any pending write immediately (used on graceful shutdown). */
export async function flushNow(): Promise<void> {
  if (!ENABLED) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await lastWrite;
  await persistNow();
}
