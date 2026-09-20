import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/account/session";
import { dispatchSoon } from "@/lib/comms/service";
import { postMessage } from "@/lib/comms/messaging";
import { loadThread, messagingDeps } from "@/lib/comms/messaging-deps";
import { supabaseAdmin } from "@/lib/supabase-server";

const QuerySchema = z.object({ booking: z.string().uuid() });
const BodySchema = z.object({ booking_id: z.string().uuid(), body: z.string().max(4000) });

const REASONS: Record<string, [number, string]> = {
  not_found: [404, "Booking not found."],
  forbidden: [403, "You can only message about your own bookings."],
  closed: [409, "This booking is closed, so messages are turned off."],
  empty: [400, "Write a message first."],
  too_long: [400, "That message is too long."],
  off_platform_payment: [400, "For your safety, payments must stay on BestCar. Please remove any payment request."],
  contact_details: [400, "Phone numbers, emails and links can be shared once the booking is paid."],
};

/** GET /api/account/messages?booking=<id> — the thread for one of the caller's bookings. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const { booking } = QuerySchema.parse({ booking: request.nextUrl.searchParams.get("booking") });
  const { data } = await supabaseAdmin.from("bookings").select("id").eq("id", booking).eq("user_id", user.id).maybeSingle();
  if (!data) throw new ApiError(404, "Booking not found.");
  return NextResponse.json({ data: await loadThread(booking, "customer") });
});

/** POST /api/account/messages — a customer's message to the rental company. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const input = BodySchema.parse(await request.json());
  const result = await postMessage(messagingDeps(), { bookingId: input.booking_id, userId: user.id, side: "customer", body: input.body });
  if (!result.ok) {
    const [status, message] = REASONS[result.reason] ?? [400, "Could not send the message."];
    throw new ApiError(status, message);
  }
  dispatchSoon();
  return NextResponse.json({ ok: true }, { status: 201 });
});
