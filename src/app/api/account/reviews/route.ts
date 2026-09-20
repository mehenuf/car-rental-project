import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireUser } from "@/lib/account/session";
import { ReviewInputSchema } from "@/lib/reviews/rules";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

const idSchema = z.string().uuid();

/** POST /api/account/reviews — a renter reviews the rental company after a completed booking. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const body = await request.json();
  const bookingId = idSchema.parse(body.booking_id);
  const input = ReviewInputSchema("customer_to_provider").parse(body);

  const { data, error } = await supabaseAdmin.rpc("submit_review", {
    p_booking_id: bookingId,
    p_direction: "customer_to_provider",
    p_author: user.id,
    p_overall: input.overall,
    p_aspects: input.aspects,
    p_comment: input.comment ?? null,
  });
  if (error) throw toTrustError(error, "review");
  return NextResponse.json({ status: data.status }, { status: 201 });
});

/** PUT /api/account/reviews — edit a review for 48 hours, while it is still hidden. */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const body = await request.json();
  const reviewId = idSchema.parse(body.review_id);
  const input = ReviewInputSchema("customer_to_provider").parse(body);

  const { data, error } = await supabaseAdmin.rpc("edit_review", {
    p_review_id: reviewId,
    p_author: user.id,
    p_overall: input.overall,
    p_aspects: input.aspects,
    p_comment: input.comment ?? null,
  });
  if (error) throw toTrustError(error, "review");
  return NextResponse.json({ status: data.status });
});
