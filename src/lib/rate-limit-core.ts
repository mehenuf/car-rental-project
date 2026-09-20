export type HitFn = (key: string, windowSeconds: number, limit: number) => Promise<{ allowed: boolean }>;

export interface RateLimiterOptions {
  name: string;
  limit: number;
  windowMs: number;
  hit: HitFn;
  maxTrackedVisitors?: number;
}

/**
 * A rate limiter over a shared counter store. Each call site names its own limiter, so a burst against one
 * endpoint does not use another endpoint's budget. If the store cannot be reached it falls back to a
 * per-instance in-memory count (still slowing a single script) rather than blocking real customers or
 * letting everything through.
 */
export function buildRateLimiter(options: RateLimiterOptions) {
  const { name, limit, windowMs, hit, maxTrackedVisitors = 5000 } = options;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const local = new Map<string, number[]>();

  function localLimited(visitorId: string): boolean {
    const now = Date.now();
    const recent = (local.get(visitorId) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      local.set(visitorId, recent);
      return true;
    }
    recent.push(now);
    local.set(visitorId, recent);
    if (local.size > maxTrackedVisitors) local.clear();
    return false;
  }

  return async function isRateLimited(visitorId: string): Promise<boolean> {
    try {
      return !(await hit(`${name}:${visitorId}`, windowSeconds, limit)).allowed;
    } catch {
      return localLimited(visitorId);
    }
  };
}
