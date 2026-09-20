export type Channel = "email" | "sms" | "push";

/** Messages that cannot be turned off: receipts, confirmations, refunds, account and legal notices. */
const ESSENTIAL = new Set([
  "account_verification",
  "password_reset",
  "booking_received",
  "booking_confirmed",
  "booking_cancelled",
  "refund_issued",
  "pickup_instructions",
  "licence_verified",
  "licence_rejected",
  "licence_expired",
  "security_alert",
  "provider_approved",
  "provider_rejected",
  "payout_paid",
  "new_booking",
  "booking_cancelled_provider",
]);

/** The only messages that may use SMS. */
const SMS_TEMPLATES = new Set(["booking_confirmed", "pickup_reminder", "security_code"]);

/** Category used for the per-channel preference of a switchable template. */
const CATEGORY: Record<string, "reminders" | "messages"> = {
  pickup_reminder: "reminders",
  return_reminder: "reminders",
  new_message: "messages",
  review_request: "reminders",
};

export function isEssential(template: string): boolean {
  return ESSENTIAL.has(template);
}

export interface ContactState {
  emailVerified: boolean;
  phoneVerified: boolean;
  smsOptIn: boolean;
  hasPushSubscription: boolean;
}

/**
 * Which channels a notification may use for this person. Essential messages always use email;
 * switchable ones follow the saved preference (email on by default, push off until chosen).
 * SMS needs an opt-in and a verified phone; push needs a subscription. Suppressed channels never send.
 */
export function resolveChannels(input: {
  template: string;
  contact: ContactState;
  prefs: Record<string, boolean>;
  suppressed: Channel[];
}): Channel[] {
  const { template, contact, prefs, suppressed } = input;
  const category = CATEGORY[template];
  const essential = isEssential(template);
  const channels: Channel[] = [];

  const emailOn = essential || (category ? (prefs[`${category}:email`] ?? true) : true);
  if (emailOn) channels.push("email");

  if (SMS_TEMPLATES.has(template) && contact.smsOptIn && contact.phoneVerified) {
    const smsOn = category ? (prefs[`${category}:sms`] ?? true) : true;
    if (smsOn) channels.push("sms");
  }

  if (category && contact.hasPushSubscription && prefs[`${category}:push`] === true) channels.push("push");

  return channels.filter((c) => !suppressed.includes(c));
}
