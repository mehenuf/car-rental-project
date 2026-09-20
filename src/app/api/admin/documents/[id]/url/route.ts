import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { IdParamSchema } from "@/lib/provider/schemas";
import { DOCUMENT_BUCKET, createDownloadUrl } from "@/lib/provider/storage";
import { requireAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/admin/documents/[id]/url — a 60 second link for a reviewer to open a document. */
export const GET = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = IdParamSchema.parse(await context.params);
    const { data, error } = await supabaseAdmin.from("provider_documents").select("storage_path").eq("id", id).maybeSingle();
    if (error) throw new Error(`document url: ${error.message}`);
    if (!data) throw new NotFoundError("Document not found.");
    return NextResponse.json({ url: await createDownloadUrl(DOCUMENT_BUCKET, data.storage_path) });
  }
);
