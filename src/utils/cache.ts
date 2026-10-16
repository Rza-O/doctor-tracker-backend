type Entry = { expiresAt: number; value: Promise<unknown> };

const store = new Map<string, Entry>();

/**
 * Tiny in-memory TTL cache. It stores the *promise*, not the result, so
 * concurrent requests during a cold start share one computation instead of all
 * hitting the database at once (cache stampede). Failed computations are
 * evicted so the next request retries.
 *
 * In-memory = per server instance and lost on restart; with several instances
 * this would move to Redis.
 */
export function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as Promise<T>;

  const value = compute();
  store.set(key, { expiresAt: Date.now() + ttlMs, value });
  value.catch(() => store.delete(key));
  return value;
}
