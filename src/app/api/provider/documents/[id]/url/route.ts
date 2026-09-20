import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { IdParamSchema } from "@/lib/provider/schemas";
import { DOCUMENT_BUCKET, createDownloadUrl } from "@/lib/provider/storage";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/documents/[id]/url — a 60 second link to one of the provider's own documents. */
export const GET = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId } = await requireProviderAccess("documents.write");
    const { id } = IdParamSchema.parse(await context.params);

    const { data, error } = await supabaseAdmin
      .from("provider_documents")
      .select("storage_path")
      .eq("id", id)
      .eq("provider_id", providerId) // never trust the id alone: it must be this provider's
      .maybeSingle();
    if (error) throw new Error(`document url: ${error.message}`);
    if (!data) throw new NotFoundError("Document not found.");

    return NextResponse.json({ url: await createDownloadUrl(DOCUMENT_BUCKET, data.storage_path) });
  }
);
