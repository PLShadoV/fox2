// 60s rate limiter per key (in-memory)
const hits = new Map<string, number>();

export async function rateLimit(key: string, minIntervalMs = 60000) {
  const now = Date.now();
  const last = hits.get(key) ?? 0;
  const wait = last + minIntervalMs - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  hits.set(key, Date.now());
}
