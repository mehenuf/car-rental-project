import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/account/session";
import { loadDispute } from "@/lib/disputes/server";
import { OpenDisputeSchema, typesFor } from "@/lib/disputes/rules";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

const QuerySchema = z.object({ booking: z.string().uuid() });

/** GET /api/account/disputes?booking=<id> — the dispute on one of the caller's bookings, with its timeline. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const { booking } = QuerySchema.parse({ booking: request.nextUrl.searchParams.get("booking") });
  const { data } = await supabaseAdmin.from("bookings").select("id").eq("id", booking).eq("user_id", user.id).maybeSingle();
  if (!data) throw new ApiError(404, "Booking not found.");
  return NextResponse.json({ data: await loadDispute(booking) });
});

/** POST /api/account/disputes — a renter reports a problem within 48 hours of the return. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const input = OpenDisputeSchema.parse(await request.json());
  if (!typesFor("customer").includes(input.type)) throw new ApiError(400, "Choose a listing, price or service problem.");

  const { data, error } = await supabaseAdmin.rpc("open_dispute", {
    p_booking_id: input.booking_id,
    p_side: "customer",
    p_user: user.id,
    p_type: input.type,
    p_claimed_minor: input.claimed_amount_minor ?? null,
    p_body: input.body,
    p_photo_paths: input.photo_paths,
  });
  if (error) throw toTrustError(error, "dispute");
  return NextResponse.json({ id: data.id, status: data.status }, { status: 201 });
});
