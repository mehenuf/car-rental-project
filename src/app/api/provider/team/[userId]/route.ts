import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { ChangeMemberSchema, IdParamSchema } from "@/lib/provider/schemas";
import { validateRemoval, validateRoleChange } from "@/lib/provider/team";
import { supabaseAdmin } from "@/lib/supabase-server";

async function loadMembers(providerId: string) {
  const { data, error } = await supabaseAdmin.from("provider_members").select("user_id, role, branch_id").eq("provider_id", providerId);
  if (error) throw new Error(`team: ${error.message}`);
  return (data ?? []).map((m) => ({ userId: m.user_id, role: m.role, branchId: m.branch_id }));
}

/** PATCH /api/provider/team/[userId] — switch a member between manager and agent. */
export const PATCH = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ userId: string }> }) => {
    const { providerId } = await requireProviderAccess("team.manage");
    const { id: userId } = IdParamSchema.parse({ id: (await context.params).userId });
    const { role } = ChangeMemberSchema.parse(await request.json());

    const problem = validateRoleChange(await loadMembers(providerId), userId, role);
    if (problem) throw new ConflictError(problem);

    const { error } = await supabaseAdmin.from("provider_members").update({ role }).eq("provider_id", providerId).eq("user_id", userId);
    if (error) throw new Error(`team: ${error.message}`);
    return NextResponse.json({ ok: true });
  }
);

/** DELETE /api/provider/team/[userId] — remove a member. The last owner can never be removed. */
export const DELETE = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ userId: string }> }) => {
    const { providerId, userId: actingUserId } = await requireProviderAccess("team.manage");
    const { id: userId } = IdParamSchema.parse({ id: (await context.params).userId });

    const problem = validateRemoval(await loadMembers(providerId), userId, actingUserId);
    if (problem) throw new ConflictError(problem);

    const { error } = await supabaseAdmin.from("provider_members").delete().eq("provider_id", providerId).eq("user_id", userId);
    if (error) throw new Error(`team: ${error.message}`);
    return NextResponse.json({ ok: true });
  }
);
