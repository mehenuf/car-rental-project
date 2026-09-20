import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { majorToMinor } from "@/lib/pricing/money";
import { requireProviderAccess } from "@/lib/provider/context";
import { canAccessBranch } from "@/lib/provider/permissions";
import { UpdateBranchSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** PATCH /api/provider/branches/[id] — name, address, turnaround time, pick-up surcharge, or switching the branch off. */
export const PATCH = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership } = await requireProviderAccess("fleet.write");
    // Branch ids are integers (unlike the UUIDs used elsewhere).
    const branchId = Number((await context.params).id);
    if (!Number.isInteger(branchId) || branchId <= 0) throw new ApiError(400, "Invalid branch.");

    const input = UpdateBranchSchema.parse(await request.json());

    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .select("id, currency")
      .eq("id", branchId)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (error) throw new Error(`branch: ${error.message}`);
    if (!branch) throw new NotFoundError("Branch not found.");
    if (!canAccessBranch(membership, branch.id)) throw new ApiError(403, "You can only manage your own branch.");

    if (input.is_active === false) {
      const { count } = await supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("pickup_branch_id", branchId)
        .in("status", ["pending", "confirmed", "active"])
        .gt("dropoff_at", new Date().toISOString());
      if ((count ?? 0) > 0) throw new ConflictError("This branch has upcoming bookings. Complete or cancel them first.");
    }

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.turnaround_minutes !== undefined) update.turnaround_minutes = input.turnaround_minutes;
    if (input.is_active !== undefined) update.is_active = input.is_active;
    if (input.pickup_surcharge !== undefined) update.pickup_surcharge_minor = majorToMinor(input.pickup_surcharge, branch.currency);
    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabaseAdmin.from("branches").update(update as never).eq("id", branchId).eq("provider_id", providerId);
      if (updateError) throw new Error(`branch: ${updateError.message}`);
    }

    if (input.address !== undefined) {
      const { error: addressError } = await supabaseAdmin
        .from("branch_private")
        .upsert({ branch_id: branchId, provider_id: providerId, address: input.address });
      if (addressError) throw new Error(`branch: ${addressError.message}`);
    }
    return NextResponse.json({ ok: true });
  }
);
