import { z } from "zod";
import { hasLocale } from "@/lib/i18n/locales";

/** A phone number in E.164 form (+ then 7 to 15 digits, not starting with 0), or null. */
export function normalizePhone(input: string): string | null {
  const cleaned = input.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null;
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const ChannelSwitches = z.object({ email: z.boolean(), sms: z.boolean(), push: z.boolean() }).partial().strict();

export const NotificationSettingsSchema = z.object({
  preferences: z.object({ reminders: ChannelSwitches, messages: ChannelSwitches }).partial().strict().optional(),
  timezone: z.string().refine(isTimeZone, "Unknown time zone").optional(),
  locale: z.string().refine(hasLocale, "Unsupported language").optional(),
  sms_opt_in: z.boolean().optional(),
});

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const PhoneStartSchema = z.object({ phone: z.string().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) ctx.addIssue({ code: "custom", message: "Enter the number with its country code, like +44 7700 900123" });
  return n ?? "";
}) });

export const PhoneVerifySchema = z.object({ code: z.string().trim().regex(/^\d{4,8}$/, "Enter the code we sent") });
