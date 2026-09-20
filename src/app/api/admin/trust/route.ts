import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { DecideDisputeSchema } from "@/lib/disputes/rules";
import { disputePorts } from "@/lib/disputes/server";
import { executeResolution } from "@/lib/disputes/service";
import { getSessionUser } from "@/lib/guest";
import { requireAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

/** GET /api/admin/trust — escalated disputes, open reports and bookings held for review. */
export const GET = withErrorHandling(async () => {
  await requireAdmin();
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

/** POST /api/admin/trust — a reviewer's decision. Every action needs a signed-in admin; money moves only through the dispute service. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const admin = await getSessionUser(true);
  if (!admin) throw new ApiError(401, "Admin authentication required");
  const input = ActionSchema.parse(await request.json());

  switch (input.action) {
    case "decide_dispute":
      await executeResolution(disputePorts(), {
        disputeId: input.dispute_id,
        resolution: input.resolution,
        amountMinor: input.amount_minor,
        actorUserId: admin.id,
        actorSide: "platform",
        note: input.note,
      });
      break;
    case "handle_report": {
      const { error } = await supabaseAdmin.from("reports").update({ status: input.outcome, handled_by: admin.id, handled_at: new Date().toISOString() }).eq("id", input.report_id);
      if (error) throw toTrustError(error, "report");
      break;
    }
    case "clear_booking": {
      const { error } = await supabaseAdmin.from("bookings").update({ risk_status: "cleared" }).eq("id", input.booking_id).eq("risk_status", "held");
      if (error) throw toTrustError(error, "report");
      break;
    }
    case "suspend_user": {
      const { error } = await supabaseAdmin.from("user_flags").upsert({ user_id: input.user_id, suspended: input.suspended, reason: input.reason, updated_by: admin.id, updated_at: new Date().toISOString() });
      if (error) throw toTrustError(error, "report");
      break;
    }
    case "remove_review": {
      const { error } = await supabaseAdmin.rpc("remove_review", { p_review_id: input.review_id, p_reason: input.reason });
      if (error) throw toTrustError(error, "review");
      break;
    }
  }
  return NextResponse.json({ ok: true });
});
