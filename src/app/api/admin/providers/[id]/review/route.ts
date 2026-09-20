import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { canTransitionProvider, decisionToStatus } from "@/lib/provider/onboarding";
import { IdParamSchema, ProviderReviewSchema } from "@/lib/provider/schemas";
import { requireAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/admin/providers/[id]/review — approve, reject (with a reason),
 * suspend (with a reason) or reinstate a provider. The status machine decides
 * what is allowed from the current state.
 */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = IdParamSchema.parse(await context.params);
    const { decision, note } = ProviderReviewSchema.parse(await request.json());

    const { data: provider, error } = await supabaseAdmin.from("providers").select("id, status").eq("id", id).maybeSingle();
    if (error) throw new Error(`review: ${error.message}`);
    if (!provider) throw new NotFoundError("Provider not found.");

    let target;
    try {
      target = decisionToStatus(decision, note ?? null);
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Invalid decision.");
    }
    if (!canTransitionProvider(provider.status, target)) {
      throw new ConflictError(`A ${provider.status.replace("_", " ")} provider cannot be moved to ${target}.`);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("providers")
      .update({ status: target, reviewed_at: new Date().toISOString(), review_note: note?.trim() || null })
      .eq("id", id)
      .select("id, status, review_note, reviewed_at")
      .single();
    if (updateError) throw new Error(`review: ${updateError.message}`);

    // Approving an account accepts the documents it was approved on (car documents are reviewed with each car).
    if (target === "approved" && decision === "approve") {
      await supabaseAdmin
        .from("provider_documents")
        .update({ status: "accepted" })
        .eq("provider_id", id)
        .eq("status", "pending")
        .is("fleet_unit_id", null);
    }

    return NextResponse.json(updated);
  }
);
