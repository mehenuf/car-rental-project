import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { loadDispute } from "@/lib/disputes/server";
import { OpenDisputeSchema, typesFor } from "@/lib/disputes/rules";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

const QuerySchema = z.object({ booking: z.string().uuid().optional() });

/** GET /api/provider/disputes[?booking=<id>] — the provider's disputes, or one booking's dispute with its timeline. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { providerId } = await requireProviderAccess("bookings.read");
  const { booking } = QuerySchema.parse({ booking: request.nextUrl.searchParams.get("booking") ?? undefined });

  if (booking) {
    const { data } = await supabaseAdmin.from("bookings").select("id").eq("id", booking).eq("provider_id", providerId).maybeSingle();
    if (!data) throw new ApiError(404, "Booking not found.");
    return NextResponse.json({ data: await loadDispute(booking) });
  }
  const { data: mine } = await supabaseAdmin.from("bookings").select("id, reference").eq("provider_id", providerId);
  const ids = (mine ?? []).map((b) => b.id);
  if (ids.length === 0) return NextResponse.json({ data: [] });
  const { data } = await supabaseAdmin.from("disputes").select("id, booking_id, type, status, claimed_amount_minor, offer_minor, offer_by_side, currency, deadline_at, created_at").in("booking_id", ids).order("created_at", { ascending: false }).limit(100);
  const refs = new Map((mine ?? []).map((b) => [b.id, b.reference]));
  return NextResponse.json({ data: (data ?? []).map((d) => ({ ...d, reference: refs.get(d.booking_id) ?? "" })) });
});

/** POST /api/provider/disputes — claim damage or cleaning and fees against the deposit, within 48 hours of the return. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, userId } = await requireProviderAccess("bookings.operate");
  const input = OpenDisputeSchema.parse(await request.json());
  if (!typesFor("provider").includes(input.type)) throw new ApiError(400, "Choose damage or cleaning and fees.");

  const { data: booking } = await supabaseAdmin.from("bookings").select("id").eq("id", input.booking_id).eq("provider_id", providerId).maybeSingle();
  if (!booking) throw new ApiError(404, "Booking not found.");

  const { data, error } = await supabaseAdmin.rpc("open_dispute", {
    p_booking_id: input.booking_id,
    p_side: "provider",
    p_user: userId,
    p_type: input.type,
    p_claimed_minor: input.claimed_amount_minor ?? null,
    p_body: input.body,
    p_photo_paths: input.photo_paths,
  });
  if (error) throw toTrustError(error, "dispute");
  return NextResponse.json({ id: data.id, status: data.status }, { status: 201 });
});
