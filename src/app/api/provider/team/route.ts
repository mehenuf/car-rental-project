import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError, RateLimitError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { AddMemberSchema } from "@/lib/provider/schemas";
import { validateNewMember } from "@/lib/provider/team";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

const isRateLimited = createRateLimiter({ name: "provider/team", limit: 10, windowMs: 60_000 });

/** GET /api/provider/team — everyone on the account with their role, branch scope and email. */
export const GET = withErrorHandling(async () => {
  const { providerId } = await requireProviderAccess("team.manage");
  const { data, error } = await supabaseAdmin
    .from("provider_members")
    .select("user_id, role, branch_id, created_at")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`team: ${error.message}`);

  const members = await Promise.all(
    (data ?? []).map(async (m) => {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        branch_id: m.branch_id,
        email: user.user?.email ?? null,
        name: (user.user?.user_metadata?.full_name as string | undefined) ?? null,
      };
    })
  );
  return NextResponse.json({ data: members });
});

/**
 * POST /api/provider/team — the owner adds someone who already has an account,
 * by email, as a manager or an agent (optionally limited to one branch).
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (await isRateLimited(getVisitorId(request))) throw new RateLimitError();
  const { providerId } = await requireProviderAccess("team.manage");
  const input = AddMemberSchema.parse(await request.json());

  const { data: userId, error: lookupError } = await supabaseAdmin.rpc("find_user_by_email", { p_email: input.email });
  if (lookupError) throw new Error(`team: ${lookupError.message}`);
  if (!userId) throw new NotFoundError("No account uses that email. Ask them to create an account first.");

  const [members, branches] = await Promise.all([
    supabaseAdmin.from("provider_members").select("user_id, role, branch_id").eq("provider_id", providerId),
    supabaseAdmin.from("branches").select("id").eq("provider_id", providerId),
  ]);
  const problem = validateNewMember(
    (members.data ?? []).map((m) => ({ userId: m.user_id, role: m.role, branchId: m.branch_id })),
    { userId, role: input.role, branchId: input.branch_id ?? null },
    (branches.data ?? []).map((b) => b.id)
  );
  if (problem) throw new ConflictError(problem);

  const { error } = await supabaseAdmin
    .from("provider_members")
    .insert({ provider_id: providerId, user_id: userId, role: input.role, branch_id: input.branch_id ?? null });
  if (error) {
    if (error.code === "23503") throw new ApiError(400, "That branch is not one of yours.");
    throw new Error(`team: ${error.message}`);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
});
