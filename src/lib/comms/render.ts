import { directionOf, type Locale } from "@/lib/i18n/locales";
import type { Params, TFunction } from "@/lib/i18n/t";
import type { Channel } from "./preferences";

/** Templates with an email, push body and message keys under `email.<name>`. */
export const TEMPLATE_NAMES = [
  "booking_confirmed",
  "booking_cancelled",
  "refund_issued",
  "pickup_reminder",
  "new_message",
  "new_booking",
  "booking_cancelled_provider",
  "payout_paid",
  "licence_verified",
  "licence_rejected",
  "licence_expired",
  "return_reminder",
  "review_request",
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/** Templates that also have a short SMS under `sms.<name>`. */
export const SMS_TEMPLATES = ["booking_confirmed", "pickup_reminder"] as const;

export interface Rendered {
  subject: string;
  text: string;
  /** Only for email. */
  html: string | null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Renders one notification for a channel from the message catalogue. `params.link` is the "view" URL. */
export function renderNotification(input: {
  template: string;
  channel: Channel;
  locale: Locale;
  params: Params;
  t: TFunction;
}): Rendered {
  const { template, channel, locale, params, t } = input;

  if (channel === "sms") {
    return { subject: "", text: t(`sms.${template}`, params), html: null };
  }

  const subject = t(`email.${template}.subject`, params);
  const body = t(`email.${template}.body`, params);

  if (channel === "push") return { subject, text: body, html: null };

  const greeting = t("email.greeting", params);
  const view = t("email.view");
  const footer = t("email.footer");
  const link = typeof params.link === "string" ? params.link : "";

  const text = [greeting, "", body, link ? `${view}: ${link}` : "", "", footer].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

  const html = `<!doctype html>
<html lang="${locale}" dir="${directionOf(locale)}">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,sans-serif;color:#18181b">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px">
<tr><td>
<p style="font-size:18px;font-weight:700;margin:0 0 16px">BestCar</p>
<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 20px;line-height:1.5">${escapeHtml(body)}</p>
${link ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 18px">${escapeHtml(view)}</a></p>` : ""}
<p style="margin:0;font-size:12px;color:#71717a">${escapeHtml(footer)}</p>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}
