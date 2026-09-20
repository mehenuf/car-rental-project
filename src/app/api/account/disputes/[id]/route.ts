import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireUser } from "@/lib/account/session";
import { RespondDisputeSchema } from "@/lib/disputes/rules";
import { respondToDispute } from "@/lib/disputes/server";
import { dispatchSoon } from "@/lib/comms/service";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

const ParamsSchema = z.object({ id: z.string().uuid() });

/** POST /api/account/disputes/[id] — the renter adds a message or evidence, or accepts, counters or contests an offer. */
export const POST = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = ParamsSchema.parse(await context.params);
  const input = RespondDisputeSchema.parse(await request.json());

  if (input.action === "contest" && input.body === undefined) input.body = "";
  const dispute = await respondToDispute(id, "customer", user.id, input);
  dispatchSoon();
  return NextResponse.json({ status: dispute.status });
});

/** DELETE is not offered; a renter who wants a reviewer to decide uses `contest`. */
export const PUT = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = ParamsSchema.parse(await context.params);
  const { error, data } = await supabaseAdmin.rpc("escalate_dispute", { p_dispute_id: id, p_side: "customer", p_user: user.id, p_body: "Asked for a reviewer" });
  if (error) throw toTrustError(error, "dispute");
  void request;
  return NextResponse.json({ status: data.status });
});
