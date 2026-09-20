import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, NotFoundError } from "@/lib/errors";
import { DocumentReviewSchema, IdParamSchema } from "@/lib/provider/schemas";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

/** POST /api/admin/documents/[id]/review — accept a document, or reject it with a reason so the provider uploads a replacement. */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const ctx = await requireStaff("documents.review");
    const { id } = IdParamSchema.parse(await context.params);
    const { status, note } = DocumentReviewSchema.parse(await request.json());
    if (status === "rejected" && !note?.trim()) throw new ApiError(400, "A reason is required to reject a document.");

    const { data, error } = await supabaseAdmin
      .from("provider_documents")
      .update({ status, review_note: note?.trim() || null })
      .eq("id", id)
      .select("id, status, review_note")
      .maybeSingle();
    if (error) throw new Error(`document review: ${error.message}`);
    if (!data) throw new NotFoundError("Document not found.");
    await writeAudit(ctx, { action: `document.${status}`, entityType: "provider_document", entityId: id, reason: note });
    return NextResponse.json(data);
  }
);
