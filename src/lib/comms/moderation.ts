export const MAX_MESSAGE_LENGTH = 2000;

export type Moderation =
  | { ok: true; flagged: boolean; reason: "link" | null }
  | { ok: false; flagged: true; reason: "empty" | "too_long" | "off_platform_payment" | "contact_details" };

const OFF_PLATFORM_PAYMENT = /western\s*union|moneygram|wire\s*transfer|bank\s*transfer|paypal\.me|venmo|cash\s*app|zelle|crypto|bitcoin|gift\s*card/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(?:\+|00)?\d[\d\s().-]{7,}\d/;
const LINK = /https?:\/\/|www\./i;

/**
 * Simple rules for messages between customers and providers. Off-platform payment requests are
 * blocked always; email addresses and phone numbers are blocked until the booking is paid (contact
 * details stay private until then); links are allowed after payment but flagged for moderators.
 */
export function moderateMessage(body: string, ctx: { paid: boolean }): Moderation {
  const text = body.trim();
  if (text.length === 0) return { ok: false, flagged: true, reason: "empty" };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, flagged: true, reason: "too_long" };
  if (OFF_PLATFORM_PAYMENT.test(text)) return { ok: false, flagged: true, reason: "off_platform_payment" };
  if (!ctx.paid && (EMAIL.test(text) || PHONE.test(text) || LINK.test(text))) {
    return { ok: false, flagged: true, reason: "contact_details" };
  }
  if (LINK.test(text)) return { ok: true, flagged: true, reason: "link" };
  return { ok: true, flagged: false, reason: null };
}
