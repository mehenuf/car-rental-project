import { formatDateLocale } from "@/lib/i18n/format";
import { numberingLocale } from "@/lib/i18n/locales";
import { withLocale } from "@/lib/i18n/negotiate";
import type { Params } from "@/lib/i18n/t";
import { formatMinor } from "@/lib/pricing/money";
import type { OutboxEvent, Recipient } from "./types";

/** The values a template needs, taken from the event and formatted for the recipient. */
export function buildParams(event: OutboxEvent, recipient: Recipient, baseUrl: string): Params {
  const p = event.payload;
  const str = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
  const pickupAt = str("pickup_at");
  const dropoffAt = str("dropoff_at");

  let amount = "";
  if (typeof p.amount_minor === "number" && typeof p.currency === "string") {
    amount = formatMinor(p.amount_minor, p.currency, numberingLocale(recipient.locale));
  } else if (typeof p.total_amount === "number") {
    amount = String(p.total_amount);
  }

  const path = recipient.area === "provider" ? "/provider/bookings" : "/account";
  return {
    name: recipient.name || recipient.email,
    reference: str("reference"),
    dropoff: dropoffAt ? formatDateLocale(dropoffAt, recipient.locale, recipient.timezone) : "",
    note: str("note"),
    pickup: pickupAt ? formatDateLocale(pickupAt, recipient.locale, recipient.timezone) : "",
    amount,
    link: baseUrl.replace(/\/$/, "") + withLocale(recipient.locale, path),
  };
}
