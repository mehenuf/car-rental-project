import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, RateLimitError } from "@/lib/errors";
import { createRateLimiter } from "@/lib/rate-limit";
import { dispatchSoon } from "@/lib/comms/service";
import { postMessage } from "@/lib/comms/messaging";
import { loadThread, messagingDeps } from "@/lib/comms/messaging-deps";
import { requireProviderAccess } from "@/lib/provider/context";
import { supabaseAdmin } from "@/lib/supabase-server";

// Each accepted message can send an email, text or push to the renter, so a flood is limited per account.
const isLimited = createRateLimiter({ name: "provider/messages", limit: 20, windowMs: 10 * 60_000 });

const QuerySchema = z.object({ booking: z.string().uuid() });
const BodySchema = z.object({ booking_id: z.string().uuid(), body: z.string().max(4000) });

const REASONS: Record<string, [number, string]> = {
  not_found: [404, "Booking not found."],
  forbidden: [403, "You can only message about your own bookings."],
  closed: [409, "This booking is closed, so messages are turned off."],
  empty: [400, "Write a message first."],
  too_long: [400, "That message is too long."],
  off_platform_payment: [400, "Payments must stay on BestCar. Please remove any payment request."],
  contact_details: [400, "Contact details can be shared once the booking is paid."],
};

/** GET /api/provider/messages?booking=<id> — the thread for one of the provider's bookings. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { providerId } = await requireProviderAccess("bookings.read");
  const { booking } = QuerySchema.parse({ booking: request.nextUrl.searchParams.get("booking") });
  const { data } = await supabaseAdmin.from("bookings").select("id").eq("id", booking).eq("provider_id", providerId).maybeSingle();
  if (!data) throw new ApiError(404, "Booking not found.");
  return NextResponse.json({ data: await loadThread(booking, "provider") });
});

/** POST /api/provider/messages — a provider team member's message to the customer. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, userId } = await requireProviderAccess("bookings.operate");
  if (await isLimited(userId)) throw new RateLimitError();
  const input = BodySchema.parse(await request.json());
  const { data: booking } = await supabaseAdmin.from("bookings").select("id").eq("id", input.booking_id).eq("provider_id", providerId).maybeSingle();
  if (!booking) throw new ApiError(404, "Booking not found.");

  const result = await postMessage(messagingDeps(), { bookingId: input.booking_id, userId, side: "provider", body: input.body });
  if (!result.ok) {
    const [status, message] = REASONS[result.reason] ?? [400, "Could not send the message."];
    throw new ApiError(status, message);
  }
  dispatchSoon();
  return NextResponse.json({ ok: true }, { status: 201 });
});
