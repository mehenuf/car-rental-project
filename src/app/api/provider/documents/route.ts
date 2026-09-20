import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError } from "@/lib/errors";
import { buildStoragePath, validateDocument } from "@/lib/provider/onboarding";
import { requireProviderAccess } from "@/lib/provider/context";
import { DocumentUploadSchema } from "@/lib/provider/schemas";
import { DOCUMENT_BUCKET, createUploadUrl } from "@/lib/provider/storage";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { ProviderDocumentRow } from "@/types/database";

const UNIT_KINDS = ["vehicle_registration", "insurance"];

/** GET /api/provider/documents — the provider's uploaded documents and their review status. */
export const GET = withErrorHandling(async () => {
  const { providerId } = await requireProviderAccess("documents.write");
  const { data, error } = await supabaseAdmin
    .from("provider_documents")
    .select("id, fleet_unit_id, kind, file_name, mime_type, size_bytes, status, review_note, created_at")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`documents: ${error.message}`);
  return NextResponse.json({ data: data ?? [] });
});

/**
 * POST /api/provider/documents — registers a document and returns a one-time
 * upload URL. The file goes straight from the browser to private storage;
 * the path is built on the server under the provider's own folder.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId } = await requireProviderAccess("documents.write");
  const input = DocumentUploadSchema.parse(await request.json());

  const problem = validateDocument({ mimeType: input.mime_type, sizeBytes: input.size_bytes });
  if (problem) throw new ApiError(400, problem);

  const perCar = UNIT_KINDS.includes(input.kind);
  if (perCar !== Boolean(input.fleet_unit_id)) {
    throw new ApiError(400, perCar ? "This document must be attached to a car." : "This document belongs to the account, not a car.");
  }
  if (input.fleet_unit_id) {
    const { data: unit, error } = await supabaseAdmin
      .from("fleet_units")
      .select("id")
      .eq("id", input.fleet_unit_id)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (error) throw new Error(`documents: ${error.message}`);
    if (!unit) throw new ConflictError("That car does not belong to your account.");
  }

  const path = buildStoragePath(providerId, input.file_name, randomUUID());
  const { data: row, error: insertError } = await supabaseAdmin
    .from("provider_documents")
    .insert({
      provider_id: providerId,
      fleet_unit_id: input.fleet_unit_id ?? null,
      kind: input.kind,
      storage_path: path,
      file_name: input.file_name,
      mime_type: input.mime_type as ProviderDocumentRow["mime_type"],
      size_bytes: input.size_bytes,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`documents: ${insertError.message}`);

  const upload = await createUploadUrl(DOCUMENT_BUCKET, path);
  return NextResponse.json(
    { document_id: row.id, bucket: DOCUMENT_BUCKET, path, token: upload.token, upload_url: upload.signedUrl },
    { status: 201 }
  );
});
