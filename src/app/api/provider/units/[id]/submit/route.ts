import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { missingUnitDocuments } from "@/lib/provider/onboarding";
import { IdParamSchema } from "@/lib/provider/schemas";
import { DOCUMENT_BUCKET, objectExists } from "@/lib/provider/storage";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/provider/units/[id]/submit — a private owner sends one car for
 * review. Needs the registration and insurance documents (really uploaded, not
 * rejected). Only draft or rejected cars can be submitted.
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership } = await requireProviderAccess("fleet.write");
    const { id } = IdParamSchema.parse(await context.params);

    if (membership.provider.type !== "individual") {
      throw new ConflictError("Company cars do not need a separate review.");
    }
    if (membership.provider.status !== "approved") {
      throw new ApiError(403, "Your account must be approved before you can submit a car.");
    }

    const { data: unit, error } = await supabaseAdmin
      .from("fleet_units")
      .select("id, listing_status")
      .eq("id", id)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (error) throw new Error(`submit unit: ${error.message}`);
    if (!unit) throw new NotFoundError("Car not found.");
    if (unit.listing_status !== "draft" && unit.listing_status !== "rejected") {
      throw new ConflictError("This car has already been submitted.");
    }

    const { data: docs, error: docsError } = await supabaseAdmin
      .from("provider_documents")
      .select("kind, status, storage_path")
      .eq("provider_id", providerId)
      .eq("fleet_unit_id", id);
    if (docsError) throw new Error(`submit unit: ${docsError.message}`);

    const uploaded = [];
    for (const doc of docs ?? []) if (await objectExists(DOCUMENT_BUCKET, doc.storage_path)) uploaded.push(doc);
    const missing = missingUnitDocuments(uploaded);
    if (missing.length > 0) {
      throw new ApiError(400, `Please upload: ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}.`);
    }

    const { error: updateError } = await supabaseAdmin
      .from("fleet_units")
      .update({ listing_status: "pending_review", review_note: null })
      .eq("id", id)
      .eq("provider_id", providerId);
    if (updateError) throw new Error(`submit unit: ${updateError.message}`);
    return NextResponse.json({ listing_status: "pending_review" });
  }
);
