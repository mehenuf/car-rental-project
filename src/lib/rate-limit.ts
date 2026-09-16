import "server-only";
import type { NextRequest } from "next/server";

/** The FIRST entry in x-forwarded-for is whatever the client itself sent —
 * trivially spoofable. The LAST entry is the one our own edge/proxy
 * appended after seeing the real socket, so it's the only hop in the
 * chain a client can't forge. */
export function getVisitorId(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",");
    const lastHop = hops.at(-1);
    if (lastHop) return lastHop.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * A plain in-memory sliding-window rate limiter — not shared across
 * server instances and reset on every deploy/restart, which is fine for
 * what this is: a soft speed bump against a single script hammering an
 * endpoint, not a durable abuse ledger. Each call site gets its own
 * independent limiter (and therefore its own independent visitor map) via
 * this factory, so a burst against one endpoint doesn't consume another
 * endpoint's budget.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  /** Clears the whole map once it holds this many visitors, so it can
   * never grow without bound on a long-running server. */
  maxTrackedVisitors?: number;
}) {
  const { limit, windowMs, maxTrackedVisitors = 5000 } = options;
  const hits = new Map<string, number[]>();

  return function isRateLimited(visitorId: string): boolean {
    const now = Date.now();
    const recent = (hits.get(visitorId) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
      hits.set(visitorId, recent);
      return true;
    }

    recent.push(now);
    hits.set(visitorId, recent);

    if (hits.size > maxTrackedVisitors) {
      hits.clear();
    }

    return false;
  };
}
