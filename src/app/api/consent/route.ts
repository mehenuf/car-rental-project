import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { RateLimitError } from "@/lib/errors";
import { CURRENT_POLICY_VERSION } from "@/lib/consent";
import { getSessionUser } from "@/lib/guest";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

const isLimited = createRateLimiter({ name: "consent", limit: 20, windowMs: 60_000 });
const BodySchema = z.object({ analytics: z.boolean() });

/**
 * POST /api/consent — keeps a record of the visitor's cookie choice with the policy version it applied to. The
 * record is tied to their account when signed in, otherwise to a random id in a first-party cookie. The IP address
 * is stored only as a salted hash.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const visitor = getVisitorId(request);
  if (await isLimited(visitor)) throw new RateLimitError();
  const { analytics } = BodySchema.parse(await request.json());

  const user = await getSessionUser(true);
  const cookieStore = await cookies();
  let anonId = cookieStore.get("bc_anon")?.value;
  if (!user && !anonId) {
    anonId = randomUUID();
    cookieStore.set("bc_anon", anonId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const ipHash = createHash("sha256").update(`${process.env.CONSENT_SALT ?? "bestcar"}:${visitor}`).digest("hex").slice(0, 32);

  const base = { user_id: user?.id ?? null, anon_id: user ? null : (anonId ?? null), policy_version: CURRENT_POLICY_VERSION, ip_hash: ipHash };
  const { error } = await supabaseAdmin.from("consents").insert([
    { ...base, purpose: "necessary" as const, granted: true },
    { ...base, purpose: "analytics" as const, granted: analytics },
  ]);
  if (error) throw new Error(`consent: ${error.message}`);
  return NextResponse.json({ ok: true }, { status: 201 });
});
