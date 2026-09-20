import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError } from "@/lib/errors";
import { canTransition } from "@/lib/account/licence";
import { LicenceReviewSchema } from "@/lib/account/schemas";
import { getSessionUser } from "@/lib/guest";
import { requireAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-server";

const ParamsSchema = z.object({ userId: z.string().uuid() });

/** POST /api/admin/licences/[userId] — approve or reject a licence that is waiting for review. */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ userId: string }> }) => {
    await requireAdmin();
    const { userId } = ParamsSchema.parse(await context.params);
    const review = LicenceReviewSchema.parse(await request.json());
    const reviewer = await getSessionUser(true);

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
        reviewed_by: reviewer?.id ?? null,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (updateError) throw new Error(`licence review: ${updateError.message}`);
    return NextResponse.json({ status: to });
  }
);
