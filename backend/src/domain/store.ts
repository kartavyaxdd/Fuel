import { supabase, supabaseEnabled } from '../db';

/**
 * Persistence layer — stores domain snapshots in Supabase.
 *
 * Two access patterns:
 *   1. Provider system (global/default user) — domain stores register a named
 *      provider; loadAll() rehydrates at boot; scheduleSave() debounces writes.
 *   2. User-scoped (multi-user) — select/upsert/deleteKey with a userId param,
 *      which prefixes the key as `userId:key` for per-user namespacing.
 *
 * When Supabase env vars are missing the app runs in-memory only.
 * Under NODE_ENV=test persistence is disabled entirely.
 */

const ENABLED = process.env.NODE_ENV !== 'test' && supabaseEnabled;

interface Provider {
  name: string;
  export: () => unknown;
  import: (data: unknown) => void;
}

const providers = new Map<string, Provider>();

let lastWrite: Promise<void> = Promise.resolve();

/** Register a domain store's snapshot provider. Called at module load. */
export function registerStore(
  name: string,
  exportFn: () => unknown,
  importFn: (data: unknown) => void,
): void {
  providers.set(name, { name, export: exportFn, import: importFn });
}

/** Prefix a key with userId for per-user namespacing. */
export function scopedKey(key: string, userId?: string): string {
  return userId ? `${userId}:${key}` : key;
}

/** Read user-scoped data directly from Supabase (bypasses provider cache). */
export async function select(key: string, userId?: string): Promise<unknown> {
  const actualKey = scopedKey(key, userId);
  if (!ENABLED || !supabase) {
    // Fallback to provider in-memory state for default user
    const p = providers.get(key);
    return p ? p.export() : null;
  }
  const { data, error } = await supabase
    .from('store')
    .select('value')
    .eq('key', actualKey)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error(`[store] select failed for "${actualKey}":`, error.message);
  }
  return data?.value ?? null;
}

/** Write user-scoped data directly to Supabase. */
export async function upsert(key: string, value: unknown, userId?: string): Promise<void> {
  const actualKey = scopedKey(key, userId);
  if (!ENABLED || !supabase) return;
  const { error } = await supabase
    .from('store')
    .upsert({ key: actualKey, value: JSON.stringify(value) }, { onConflict: 'key', ignoreDuplicates: false });
  if (error) console.error(`[store] upsert failed for "${actualKey}":`, error.message);
}

/** Delete a single user-scoped key from Supabase. */
export async function deleteKey(key: string, userId?: string): Promise<void> {
  if (!ENABLED || !supabase) return;
  const actualKey = scopedKey(key, userId);
  const { error } = await supabase.from('store').delete().eq('key', actualKey);
  if (error) console.error(`[store] delete failed for "${actualKey}":`, error.message);
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
    lastWrite.catch(() => { /* swallow */ });
  }, SAVE_DEBOUNCE_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

/** Delete all rows, or a single user's rows when userId is given. */
export async function resetStore(userId?: string): Promise<void> {
  if (!ENABLED || !supabase) return;
  if (userId) {
    const prefix = `${userId}:`;
    const { error } = await supabase
      .from('store')
      .delete()
      .like('key', `${prefix}%`);
    if (error) console.error('[store] reset failed:', error.message);
  } else {
    const { error } = await supabase.from('store').delete().neq('key', '');
    if (error) console.error('[store] reset failed:', error.message);
  }
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
