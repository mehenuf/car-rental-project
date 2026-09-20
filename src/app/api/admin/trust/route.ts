import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { needsApproval } from "@/lib/admin/approvals";
import { can, type Permission } from "@/lib/admin/permissions";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { DecideDisputeSchema } from "@/lib/disputes/rules";
import { disputePorts } from "@/lib/disputes/server";
import { executeResolution } from "@/lib/disputes/service";
import { ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

/** GET /api/admin/trust — escalated disputes, open reports and bookings held for review. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireStaff();
  if (!(can(ctx.role, "disputes.decide") || can(ctx.role, "reports.handle") || can(ctx.role, "risk.clear"))) throw new ApiError(403, "Your role cannot do that.");
  const [{ data: disputes }, { data: reports }, { data: held }] = await Promise.all([
    supabaseAdmin
      .from("disputes")
      .select("id, booking_id, type, status, claimed_amount_minor, offer_minor, currency, opened_by_side, created_at")
      .eq("status", "escalated")
      .order("created_at")
      .limit(50),
    supabaseAdmin.from("reports").select("id, kind, target_id, reason, created_at").eq("status", "open").order("created_at").limit(50),
    supabaseAdmin.from("bookings").select("id, reference, total_amount, currency, risk_flags, pickup_at").eq("risk_status", "held").order("pickup_at").limit(50),
  ]);
  return NextResponse.json({ disputes: disputes ?? [], reports: reports ?? [], held: held ?? [] });
});

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("decide_dispute"), dispute_id: z.string().uuid() }).extend(DecideDisputeSchema.shape),
  z.object({ action: z.literal("handle_report"), report_id: z.string().uuid(), outcome: z.enum(["actioned", "dismissed"]) }),
  z.object({ action: z.literal("clear_booking"), booking_id: z.string().uuid() }),
  z.object({ action: z.literal("suspend_user"), user_id: z.string().uuid(), suspended: z.boolean(), reason: z.string().trim().min(1).max(300) }),
  z.object({ action: z.literal("remove_review"), review_id: z.string().uuid(), reason: z.string().trim().min(1).max(300) }),
]);

const PERMISSION: Record<z.infer<typeof ActionSchema>["action"], Permission> = {
  decide_dispute: "disputes.decide",
  handle_report: "reports.handle",
  clear_booking: "risk.clear",
  suspend_user: "users.suspend",
  remove_review: "reviews.moderate",
};

/**
 * POST /api/admin/trust — a reviewer's decision. Each action needs its own permission and is audited. A dispute
 * decision above the deciding role's limit is not carried out: it becomes an approval for a second person.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const input = ActionSchema.parse(await request.json());
  const ctx = await requireStaff(PERMISSION[input.action]);

  switch (input.action) {
    case "decide_dispute": {
      const { data: dispute } = await supabaseAdmin.from("disputes").select("currency").eq("id", input.dispute_id).maybeSingle();
      if (!dispute) throw new ApiError(404, "Dispute not found.");
      const amount = input.amount_minor ?? 0;
      if (input.resolution !== "dismiss" && needsApproval({ kind: "dispute_decision", role: ctx.role, amountMinor: amount, currency: dispute.currency })) {
        const payload = { dispute_id: input.dispute_id, resolution: input.resolution, amount_minor: input.amount_minor, note: input.note };
        const { data, error } = await supabaseAdmin
          .from("approvals")
          .insert({ kind: "dispute_decision", payload, amount_minor: amount, currency: dispute.currency, requested_by: ctx.userId })
          .select("id")
          .single();
        if (error) throw new Error(`approval: ${error.message}`);
        await writeAudit(ctx, { action: "dispute.request_approval", entityType: "dispute", entityId: input.dispute_id, after: payload, reason: input.note });
        return NextResponse.json({ approvalRequired: true, approvalId: data.id }, { status: 202 });
      }
      await executeResolution(disputePorts(), {
        disputeId: input.dispute_id, resolution: input.resolution, amountMinor: input.amount_minor,
        actorUserId: ctx.userId, actorSide: "platform", note: input.note,
      });
      await writeAudit(ctx, { action: "dispute.decide", entityType: "dispute", entityId: input.dispute_id, after: { resolution: input.resolution, amount_minor: input.amount_minor }, reason: input.note });
      break;
    }
    case "handle_report": {
      const { error } = await supabaseAdmin.from("reports").update({ status: input.outcome, handled_by: ctx.userId, handled_at: new Date().toISOString() }).eq("id", input.report_id);
      if (error) throw toTrustError(error, "report");
      await writeAudit(ctx, { action: `report.${input.outcome}`, entityType: "report", entityId: input.report_id });
      break;
    }
    case "clear_booking": {
      const { error } = await supabaseAdmin.from("bookings").update({ risk_status: "cleared" }).eq("id", input.booking_id).eq("risk_status", "held");
      if (error) throw toTrustError(error, "report");
      await writeAudit(ctx, { action: "risk.clear", entityType: "booking", entityId: input.booking_id });
      break;
    }
    case "suspend_user": {
      const { error } = await supabaseAdmin.from("user_flags").upsert({ user_id: input.user_id, suspended: input.suspended, reason: input.reason, updated_by: ctx.userId, updated_at: new Date().toISOString() });
      if (error) throw toTrustError(error, "report");
      await writeAudit(ctx, { action: input.suspended ? "user.suspend" : "user.reinstate", entityType: "user", entityId: input.user_id, reason: input.reason });
      break;
    }
    case "remove_review": {
      const { error } = await supabaseAdmin.rpc("remove_review", { p_review_id: input.review_id, p_reason: input.reason });
      if (error) throw toTrustError(error, "review");
      await writeAudit(ctx, { action: "review.remove", entityType: "review", entityId: input.review_id, reason: input.reason });
      break;
    }
  }
  return NextResponse.json({ ok: true });
});
