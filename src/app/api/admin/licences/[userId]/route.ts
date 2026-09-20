import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError } from "@/lib/errors";
import { canTransition } from "@/lib/account/licence";
import { LicenceReviewSchema } from "@/lib/account/schemas";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

const ParamsSchema = z.object({ userId: z.string().uuid() });

/** POST /api/admin/licences/[userId] — approve or reject a licence that is waiting for review. */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ userId: string }> }) => {
    const ctx = await requireStaff("licences.review");
    const { userId } = ParamsSchema.parse(await context.params);
    const review = LicenceReviewSchema.parse(await request.json());

    const to = review.decision === "approve" ? "verified" : "rejected";
    const { data: profile, error } = await supabaseAdmin
      .from("driver_profiles")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`licence review: ${error.message}`);
    if (!profile || !canTransition(profile.status, to, "reviewer")) {
      throw new ConflictError("This licence is not waiting for review.");
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("driver_profiles")
      .update({
        status: to,
        review_note: review.note ?? null,
        reviewed_at: now,
        reviewed_by: ctx.userId,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (updateError) throw new Error(`licence review: ${updateError.message}`);
    await writeAudit(ctx, { action: `licence.${to}`, entityType: "driver_profile", entityId: userId, before: { status: profile.status }, after: { status: to }, reason: review.note });
    return NextResponse.json({ status: to });
  }
);
