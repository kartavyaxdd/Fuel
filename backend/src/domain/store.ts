import fs from 'fs';
import path from 'path';

/**
 * Tiny JSON-file persistence layer.
 *
 * Domain stores (foodLog, weight, …) register a named snapshot provider —
 * an `export`/`import` pair over plain JSON. On boot the server calls
 * `loadAll()` to rehydrate every provider from disk; after each mutation a
 * provider calls `scheduleSave()`, which debounces a single atomic write of
 * the whole snapshot.
 *
 * Persistence is disabled under `NODE_ENV=test` so the pure domain suites
 * stay deterministic and never touch the filesystem.
 */

const ENABLED = process.env.NODE_ENV !== 'test';
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', '..', '.data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const SAVE_DEBOUNCE_MS = 400;

interface Provider {
  name: string;
  export: () => unknown;
  import: (data: unknown) => void;
}

const providers = new Map<string, Provider>();

/** Register a domain store's snapshot provider. Called at module load. */
export function registerStore(
  name: string,
  exportFn: () => unknown,
  importFn: (data: unknown) => void,
): void {
  providers.set(name, { name, export: exportFn, import: importFn });
}

/** Rehydrate every registered provider from the on-disk snapshot. */
export function loadAll(): void {
  if (!ENABLED) return;
  let raw: string;
  try {
    raw = fs.readFileSync(DATA_FILE, 'utf8');
  } catch {
    return; // No snapshot yet — providers keep their seeded defaults.
  }
  let snapshot: Record<string, unknown>;
  try {
    snapshot = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    console.error(`[store] corrupt snapshot at ${DATA_FILE}, ignoring:`, error);
    return;
  }
  for (const provider of providers.values()) {
    const slice = snapshot[provider.name];
    if (slice === undefined) continue;
    try {
      provider.import(slice);
    } catch (error) {
      console.error(`[store] failed to import "${provider.name}":`, error);
    }
  }
}

function writeNow(): void {
  const snapshot: Record<string, unknown> = {};
  for (const provider of providers.values()) {
    snapshot[provider.name] = provider.export();
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Atomic write: stage to a temp file then rename over the target.
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (error) {
    console.error(`[store] failed to persist snapshot to ${DATA_FILE}:`, error);
  }
}

let timer: NodeJS.Timeout | null = null;

/** Debounced persist — coalesces bursts of mutations into one write. */
export function scheduleSave(): void {
  if (!ENABLED) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    writeNow();
  }, SAVE_DEBOUNCE_MS);
  // Don't let a pending save keep the process alive.
  if (typeof timer.unref === 'function') timer.unref();
}

/** Force an immediate synchronous flush (used on graceful shutdown). */
export function flushNow(): void {
  if (!ENABLED) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  writeNow();
}
