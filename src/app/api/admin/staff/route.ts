import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { ROLES } from "@/lib/admin/permissions";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/admin/staff — every staff member with their role and email. */
export const GET = withErrorHandling(async () => {
  await requireStaff("staff.manage");
  const { data, error } = await supabaseAdmin.from("platform_staff").select("user_id, role, created_at, disabled_at").order("created_at");
  if (error) throw new Error(`staff: ${error.message}`);
  const staff = await Promise.all(
    (data ?? []).map(async (s) => ({ ...s, email: (await supabaseAdmin.auth.admin.getUserById(s.user_id)).data.user?.email ?? null }))
  );
  return NextResponse.json({ data: staff, roles: ROLES });
});

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), email: z.string().trim().toLowerCase().email(), role: z.enum(ROLES) }),
  z.object({ action: z.literal("set_role"), user_id: z.string().uuid(), role: z.enum(ROLES) }),
  z.object({ action: z.literal("disable"), user_id: z.string().uuid() }),
  z.object({ action: z.literal("enable"), user_id: z.string().uuid() }),
]);

async function superAdminCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("platform_staff").select("user_id", { count: "exact", head: true }).eq("role", "super_admin").is("disabled_at", null);
  return count ?? 0;
}

/**
 * POST /api/admin/staff — add someone (they must already have an account), change a role, disable or enable.
 * The admin claim that lets a person into /admin is set here and removed on disable; the role decides what they can do.
 * You cannot demote or disable the last active super admin, or yourself.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const ctx = await requireStaff("staff.manage");
  const input = ActionSchema.parse(await request.json());

  const setClaim = async (userId: string, admin: boolean) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { role: admin ? "admin" : null } });
    if (error) throw new Error(`staff claim: ${error.message}`);
  };

  if (input.action === "add") {
    const { data: userId, error } = await supabaseAdmin.rpc("find_user_by_email", { p_email: input.email });
    if (error) throw new Error(`staff: ${error.message}`);
    if (!userId) throw new ApiError(404, "No account with that email. Ask them to sign up first.");
    const { error: insertError } = await supabaseAdmin.from("platform_staff").upsert({ user_id: userId, role: input.role, created_by: ctx.userId, disabled_at: null });
    if (insertError) throw new Error(`staff: ${insertError.message}`);
    await setClaim(userId, true);
    await writeAudit(ctx, { action: "staff.add", entityType: "platform_staff", entityId: userId, after: { role: input.role } });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (input.user_id === ctx.userId && input.action !== "set_role") throw new ApiError(409, "You cannot disable yourself.");
  const { data: target } = await supabaseAdmin.from("platform_staff").select("role, disabled_at").eq("user_id", input.user_id).maybeSingle();
  if (!target) throw new ApiError(404, "Staff member not found.");
  const losesSuper = target.role === "super_admin" && !target.disabled_at && (input.action === "disable" || (input.action === "set_role" && input.role !== "super_admin"));
  if (losesSuper && (await superAdminCount()) <= 1) throw new ApiError(409, "There must always be at least one active super admin.");

  if (input.action === "set_role") {
    await supabaseAdmin.from("platform_staff").update({ role: input.role }).eq("user_id", input.user_id);
    await writeAudit(ctx, { action: "staff.set_role", entityType: "platform_staff", entityId: input.user_id, before: { role: target.role }, after: { role: input.role } });
  } else if (input.action === "disable") {
    await supabaseAdmin.from("platform_staff").update({ disabled_at: new Date().toISOString() }).eq("user_id", input.user_id);
    await setClaim(input.user_id, false);
    await writeAudit(ctx, { action: "staff.disable", entityType: "platform_staff", entityId: input.user_id });
  } else {
    await supabaseAdmin.from("platform_staff").update({ disabled_at: null }).eq("user_id", input.user_id);
    await setClaim(input.user_id, true);
    await writeAudit(ctx, { action: "staff.enable", entityType: "platform_staff", entityId: input.user_id });
  }
  return NextResponse.json({ ok: true });
});
