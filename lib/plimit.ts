// Tiny concurrency limiter
export function pLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let active = 0;

  const next = () => {
    active--;
    if (queue.length) queue.shift()!();
  };

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((res) => queue.push(res));
    }
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}
