import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { loadProviderBooking } from "@/lib/provider/bookings";
import { buildStoragePath, validateDocument } from "@/lib/provider/onboarding";
import { IdParamSchema, InspectionPhotoSchema } from "@/lib/provider/schemas";
import { INSPECTION_BUCKET, createUploadUrl } from "@/lib/provider/storage";

/** POST /api/provider/bookings/[id]/photos — a one-time upload URL for an inspection photo (JPG or PNG, up to 5 MB). */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership } = await requireProviderAccess("bookings.operate");
    const { id } = IdParamSchema.parse(await context.params);
    const input = InspectionPhotoSchema.parse(await request.json());

    await loadProviderBooking(providerId, membership, id);
    const problem = validateDocument({ mimeType: input.mime_type, sizeBytes: input.size_bytes });
    if (problem) throw new ApiError(400, problem);

    const path = buildStoragePath(`${providerId}/${id}`, input.file_name, randomUUID());
    const upload = await createUploadUrl(INSPECTION_BUCKET, path);
    return NextResponse.json({ bucket: INSPECTION_BUCKET, path, token: upload.token }, { status: 201 });
  }
);
