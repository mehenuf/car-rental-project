import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { canApprove } from "@/lib/admin/approvals";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { DecideDisputeSchema } from "@/lib/disputes/rules";
import { disputePorts } from "@/lib/disputes/server";
import { executeResolution } from "@/lib/disputes/service";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

/** GET /api/admin/approvals — requests waiting for a second person, and the recent ones already decided. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireStaff();
  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabaseAdmin.from("approvals").select("*").eq("status", "pending").order("requested_at"),
    supabaseAdmin.from("approvals").select("*").neq("status", "pending").order("decided_at", { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ pending: pending ?? [], recent: recent ?? [], me: { userId: ctx.userId, role: ctx.role } });
});

const DecideSchema = z.object({ id: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(500).optional() });

/**
 * POST /api/admin/approvals — decide a request. Finance or a super admin, never the requester (also enforced
 * by the database). Approving a dispute decision carries it out now; approving a fee change applies it.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const ctx = await requireStaff();
  const input = DecideSchema.parse(await request.json());

  const { data: approval } = await supabaseAdmin.from("approvals").select("*").eq("id", input.id).maybeSingle();
  if (!approval) throw new ApiError(404, "Request not found.");
  if (!canApprove({ deciderRole: ctx.role, deciderId: ctx.userId, requesterId: approval.requested_by })) {
    throw new ApiError(403, "Only finance or a super admin can decide, and not on their own request.");
  }
  if (approval.status !== "pending") throw new ApiError(409, "This request was already decided.");

  // Carry out the approved action first for the kinds that move money, so a failure leaves the request pending.
  if (input.approve && approval.kind === "dispute_decision") {
    const payload = z.object({ dispute_id: z.string().uuid() }).extend(DecideDisputeSchema.shape).parse(approval.payload);
    await executeResolution(disputePorts(), {
      disputeId: payload.dispute_id,
      resolution: payload.resolution,
      amountMinor: payload.amount_minor,
      actorUserId: ctx.userId,
      actorSide: "platform",
      note: `${payload.note} (approved by ${ctx.email ?? ctx.userId})`,
    });
  }

  const { data, error } = await supabaseAdmin.rpc("decide_approval", { p_decider: ctx.userId, p_id: input.id, p_approve: input.approve, p_note: input.note ?? null });
  if (error) {
    if (error.code === "BA011") throw new ApiError(409, "This request was already decided.");
    if (error.code === "BA012" || error.code === "23514") throw new ApiError(403, "You cannot decide this request.");
    throw toTrustError(error, "dispute");
  }
  if (input.approve && approval.kind === "dispute_decision") await supabaseAdmin.rpc("mark_approval_executed", { p_id: input.id });

  await writeAudit(ctx, { action: input.approve ? "approval.approve" : "approval.reject", entityType: "approval", entityId: input.id, after: { kind: approval.kind, status: data.status }, reason: input.note });
  return NextResponse.json({ status: data.status });
});
