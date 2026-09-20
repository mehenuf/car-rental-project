import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError } from "@/lib/errors";
import { canTransitionProvider, missingDocuments } from "@/lib/provider/onboarding";
import { requireProviderAccess } from "@/lib/provider/context";
import { DOCUMENT_BUCKET, objectExists } from "@/lib/provider/storage";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/provider/submit — the owner sends the application for review.
 * Every required document must be uploaded (the file must really exist in
 * storage) and not rejected. Works from `draft` and, after fixing problems,
 * from `rejected`.
 */
export const POST = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("team.manage");
  const { status, type } = membership.provider;
  if (!canTransitionProvider(status, "submitted")) {
    throw new ConflictError("This application cannot be submitted in its current state.");
  }

  const { data: docs, error } = await supabaseAdmin
    .from("provider_documents")
    .select("kind, status, storage_path")
    .eq("provider_id", providerId)
    .is("fleet_unit_id", null);
  if (error) throw new Error(`submit: ${error.message}`);

  // Only count documents whose file was actually uploaded.
  const uploaded = [];
  for (const doc of docs ?? []) {
    if (await objectExists(DOCUMENT_BUCKET, doc.storage_path)) uploaded.push(doc);
  }
  const missing = missingDocuments(type, uploaded);
  if (missing.length > 0) {
    throw new ApiError(400, `Please upload: ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}.`);
  }

  const { error: updateError } = await supabaseAdmin
    .from("providers")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), review_note: null })
    .eq("id", providerId);
  if (updateError) throw new Error(`submit: ${updateError.message}`);

  return NextResponse.json({ status: "submitted" });
});
