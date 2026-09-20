import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError } from "@/lib/errors";
import { DriverDocumentUploadSchema } from "@/lib/account/schemas";
import { requireUser } from "@/lib/account/session";
import { buildStoragePath } from "@/lib/provider/onboarding";
import { createUploadUrl } from "@/lib/provider/storage";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = "customer-documents";
const MAX_DOCUMENTS = 6;

/**
 * POST /api/account/driver/documents — registers a licence or selfie photo and returns a one-time
 * upload URL. The path is built here under the caller's own folder; the file goes straight from the
 * browser to private storage.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const input = DriverDocumentUploadSchema.parse(await request.json());

  const { count, error: countError } = await supabaseAdmin
    .from("driver_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) throw new Error(`driver documents: ${countError.message}`);
  if ((count ?? 0) >= MAX_DOCUMENTS) throw new ConflictError("You have reached the limit of uploaded files.");

  const path = buildStoragePath(user.id, input.file_name, randomUUID());
  const { data: row, error } = await supabaseAdmin
    .from("driver_documents")
    .insert({ user_id: user.id, kind: input.kind, storage_path: path, mime_type: input.mime_type, size_bytes: input.size_bytes })
    .select("id")
    .single();
  if (error) throw new Error(`driver documents: ${error.message}`);

  const { token } = await createUploadUrl(BUCKET, path);
  return NextResponse.json({ id: row.id, bucket: BUCKET, path, token }, { status: 201 });
});
