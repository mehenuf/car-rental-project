import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { createDownloadUrl } from "@/lib/provider/storage";
import { supabaseAdmin } from "@/lib/supabase-server";

const ParamsSchema = z.object({ userId: z.string().uuid(), id: z.string().uuid() });

/** GET /api/admin/licences/[userId]/documents/[id] — a 60-second link to view one licence photo. */
export const GET = withErrorHandling(
  async (_request: Request, context: { params: Promise<{ userId: string; id: string }> }) => {
    const ctx = await requireStaff("licences.review");
    const { userId, id } = ParamsSchema.parse(await context.params);
    const { data, error } = await supabaseAdmin
      .from("driver_documents")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`licence document: ${error.message}`);
    if (!data) throw new ApiError(404, "File not found.");
    await writeAudit(ctx, { action: "licence.view_document", entityType: "driver_document", entityId: id });
    return NextResponse.json({ url: await createDownloadUrl("customer-documents", data.storage_path, 60) });
  }
);
