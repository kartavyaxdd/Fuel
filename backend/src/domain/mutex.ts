/**
 * Per-user async mutex — serializes read-modify-write operations per userId.
 * Cross-instance races remain if >1 Render instance (currently 1 free instance).
 */

const locks = new Map<string, Promise<unknown>>();

export async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(userId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(userId, next);
  next.finally(() => {
    if (locks.get(userId) === next) locks.delete(userId);
  });
  return next;
}
