import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { IdParamSchema, UnitReviewSchema } from "@/lib/provider/schemas";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/admin/units/[id]/review — approve or reject one private owner's car.
 * Only a car that was submitted (`pending_review`) can be reviewed. Approving
 * makes it bookable; rejecting needs a reason and lets the owner fix and resubmit.
 */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const ctx = await requireStaff("cars.review");
    const { id } = IdParamSchema.parse(await context.params);
    const { decision, note } = UnitReviewSchema.parse(await request.json());
    if (decision === "reject" && !note?.trim()) throw new ApiError(400, "A reason is required to reject a car.");

    const { data: unit, error } = await supabaseAdmin.from("fleet_units").select("id, listing_status").eq("id", id).maybeSingle();
    if (error) throw new Error(`unit review: ${error.message}`);
    if (!unit) throw new NotFoundError("Car not found.");
    if (unit.listing_status !== "pending_review") {
      throw new ConflictError("Only a car that was submitted for review can be reviewed.");
    }

    const { data, error: updateError } = await supabaseAdmin
      .from("fleet_units")
      .update({ listing_status: decision === "approve" ? "approved" : "rejected", review_note: note?.trim() || null })
      .eq("id", id)
      .select("id, listing_status, review_note")
      .single();
    if (updateError) throw new Error(`unit review: ${updateError.message}`);
    await writeAudit(ctx, { action: `car.${decision}`, entityType: "fleet_unit", entityId: id, reason: note });
    return NextResponse.json(data);
  }
);
