import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { ReviewInputSchema } from "@/lib/reviews/rules";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

const idSchema = z.string().uuid();

/** GET /api/provider/reviews — reviews of this provider (with replies) and completed bookings still open for review. */
export const GET = withErrorHandling(async () => {
  const { providerId } = await requireProviderAccess("bookings.read");
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: reviews }, { data: recent }, { data: mine }] = await Promise.all([
    supabaseAdmin
      .from("reviews")
      .select("id, overall, aspects, comment, published_at")
      .eq("subject_provider_id", providerId)
      .eq("direction", "customer_to_provider")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("bookings")
      .select("id, reference, customer_name, completed_at, user_id")
      .eq("provider_id", providerId)
      .eq("status", "completed")
      .gte("completed_at", since)
      .not("user_id", "is", null)
      .order("completed_at", { ascending: false }),
    supabaseAdmin.from("reviews").select("booking_id").eq("direction", "provider_to_customer"),
  ]);
  const reviewed = new Set((mine ?? []).map((r) => r.booking_id));
  const ids = (reviews ?? []).map((r) => r.id);
  const { data: replies } = ids.length ? await supabaseAdmin.from("review_replies").select("review_id, body").in("review_id", ids) : { data: [] };
  return NextResponse.json({
    reviews: (reviews ?? []).map((r) => ({ ...r, reply: (replies ?? []).find((x) => x.review_id === r.id)?.body ?? null })),
    toReview: (recent ?? []).filter((b) => !reviewed.has(b.id)),
  });
});

/** POST /api/provider/reviews — the provider reviews the renter after a completed booking. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, userId } = await requireProviderAccess("bookings.operate");
  const body = await request.json();
  const bookingId = idSchema.parse(body.booking_id);
  const input = ReviewInputSchema("provider_to_customer").parse(body);

  const { data: booking } = await supabaseAdmin.from("bookings").select("id").eq("id", bookingId).eq("provider_id", providerId).maybeSingle();
  if (!booking) return NextResponse.json({ error: { message: "Booking not found." } }, { status: 404 });

  const { data, error } = await supabaseAdmin.rpc("submit_review", {
    p_booking_id: bookingId,
    p_direction: "provider_to_customer",
    p_author: userId,
    p_overall: input.overall,
    p_aspects: input.aspects,
    p_comment: input.comment ?? null,
  });
  if (error) throw toTrustError(error, "review");
  return NextResponse.json({ status: data.status }, { status: 201 });
});
