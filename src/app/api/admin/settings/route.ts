import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/admin/settings — the live commission and service fee, the change history, and pending change requests. */
export const GET = withErrorHandling(async () => {
  await requireStaff("fees.manage");
  const [{ data: settings }, { data: history }, { data: pending }] = await Promise.all([
    supabaseAdmin.from("platform_settings").select("commission_bp, service_fee_bp").maybeSingle(),
    supabaseAdmin.from("settings_history").select("id, changed_at, changed_by, before, after, approval_id").order("id", { ascending: false }).limit(20),
    supabaseAdmin.from("approvals").select("id, payload, requested_by, requested_at").eq("kind", "fee_change").eq("status", "pending"),
  ]);
  return NextResponse.json({ settings, history: history ?? [], pending: pending ?? [] });
});

const ChangeSchema = z
  .object({
    commission_bp: z.number().int().min(0).max(10_000).optional(),
    service_fee_bp: z.number().int().min(0).max(10_000).optional(),
    reason: z.string().trim().min(1).max(300),
  })
  .refine((v) => v.commission_bp !== undefined || v.service_fee_bp !== undefined, { message: "Change at least one value" });

/**
 * POST /api/admin/settings — asks to change the commission or service fee. Never applied directly: it becomes an
 * approval that a second finance or super admin must accept, then it is applied with a history row and an audit entry.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const ctx = await requireStaff("fees.manage");
  const input = ChangeSchema.parse(await request.json());
  const { data: pending } = await supabaseAdmin.from("approvals").select("id").eq("kind", "fee_change").eq("status", "pending").limit(1);
  if (pending && pending.length > 0) throw new ApiError(409, "A fee change is already waiting for approval.");

  const payload = { commission_bp: input.commission_bp, service_fee_bp: input.service_fee_bp, reason: input.reason };
  const { data, error } = await supabaseAdmin.from("approvals").insert({ kind: "fee_change", payload, requested_by: ctx.userId }).select("id").single();
  if (error) throw new Error(`settings: ${error.message}`);
  await writeAudit(ctx, { action: "settings.request_change", entityType: "approval", entityId: data.id, after: payload, reason: input.reason });
  return NextResponse.json({ approvalId: data.id }, { status: 201 });
});
