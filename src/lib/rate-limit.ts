import "server-only";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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

import { buildRateLimiter, type HitFn } from "@/lib/rate-limit-core";

export type { HitFn };

/** The shared store: one atomic Postgres upsert per hit (`rate_limit_hit`), so limits hold across serverless instances and restarts. */
const databaseHit: HitFn = async (key, windowSeconds, limit) => {
  const { data, error } = await supabaseAdmin.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_limit: limit });
  if (error) throw new Error(error.message);
  return { allowed: data?.[0]?.allowed ?? true };
};

export function createRateLimiter(options: { name: string; limit: number; windowMs: number; maxTrackedVisitors?: number }) {
  return buildRateLimiter({ ...options, hit: databaseHit });
}
