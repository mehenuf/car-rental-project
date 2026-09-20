import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { RateLimitError } from "@/lib/errors";
import { requireUser } from "@/lib/account/session";
import { createRateLimiter } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

const isLimited = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });

const ReportSchema = z.object({
  kind: z.enum(["listing", "user", "message", "review"]),
  target_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

/** POST /api/reports — anyone signed in can report a listing, a user, a message or a review for a moderator to look at. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  if (isLimited(user.id)) throw new RateLimitError();
  const input = ReportSchema.parse(await request.json());

  if (input.kind === "review") {
    const { error } = await supabaseAdmin.from("review_reports").insert({ review_id: input.target_id, reporter_user_id: user.id, reason: input.reason });
    if (error) throw toTrustError(error, "report");
  }
  const { error } = await supabaseAdmin.from("reports").insert({ kind: input.kind, target_id: input.target_id, reporter_user_id: user.id, reason: input.reason });
  if (error) throw toTrustError(error, "report");
  return NextResponse.json({ ok: true }, { status: 201 });
});
