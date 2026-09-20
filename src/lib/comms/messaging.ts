import { moderateMessage } from "./moderation";

export interface MessagingBooking {
  id: string;
  user_id: string | null;
  provider_id: string | null;
  payment_status: string;
  status: string;
}

export interface MessagingDeps {
  getBooking(id: string): Promise<MessagingBooking | null>;
  isProviderMember(providerId: string, userId: string): Promise<boolean>;
  ensureThread(booking: MessagingBooking): Promise<string>;
  insertMessage(m: { thread_id: string; sender_side: "customer" | "provider"; sender_user_id: string; body: string; flagged: boolean }): Promise<void>;
}

export type PostResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "forbidden" | "closed" | "empty" | "too_long" | "off_platform_payment" | "contact_details" };

/**
 * Sends a message on a booking's thread. Only the account that made the booking, or a member of
 * the provider's team, may write; messages are moderated first (see moderation.ts). Guests
 * have no account, so they message only after claiming the booking.
 */
export async function postMessage(
  deps: MessagingDeps,
  input: { bookingId: string; userId: string; side: "customer" | "provider"; body: string }
): Promise<PostResult> {
  const booking = await deps.getBooking(input.bookingId);
  if (!booking) return { ok: false, reason: "not_found" };

  const allowed =
    input.side === "customer"
      ? booking.user_id !== null && booking.user_id === input.userId
      : booking.provider_id !== null && (await deps.isProviderMember(booking.provider_id, input.userId));
  if (!allowed) return { ok: false, reason: "forbidden" };

  if (["cancelled", "no_show", "completed"].includes(booking.status)) return { ok: false, reason: "closed" };

  const paid = booking.payment_status === "paid" || booking.payment_status === "partially_refunded";
  const verdict = moderateMessage(input.body, { paid });
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const threadId = await deps.ensureThread(booking);
  await deps.insertMessage({
    thread_id: threadId,
    sender_side: input.side,
    sender_user_id: input.userId,
    body: input.body.trim(),
    flagged: verdict.flagged,
  });
  return { ok: true };
}
