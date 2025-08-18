// Simple in-memory cache with TTL (ms)
type Entry<T> = { v: T; exp: number };
const mem = new Map<string, Entry<any>>();

export async function getCached<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && hit.exp > now) return hit.v;
  const val = await fetcher().catch((e) => {
    if (hit) return hit.v; // soft fail: return stale
    throw e;
  });
  mem.set(key, { v: val, exp: now + ttlSec * 1000 });
  return val;
}

export function setCache<T>(key: string, val: T, ttlSec: number) {
  mem.set(key, { v: val, exp: Date.now() + ttlSec * 1000 });
}

export function delCache(key: string) {
  mem.delete(key);
}
