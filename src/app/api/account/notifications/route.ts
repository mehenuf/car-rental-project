import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/account/session";
import { NotificationSettingsSchema } from "@/lib/comms/settings";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/account/notifications — preferences, phone and consent, and the number of push devices. */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const [{ data: prefs }, { data: contact }, { count }] = await Promise.all([
    supabaseAdmin.from("notification_preferences").select("category, channel, enabled").eq("user_id", user.id),
    supabaseAdmin.from("contact_channels").select("phone_e164, phone_verified_at, sms_opt_in, locale, timezone").eq("user_id", user.id).maybeSingle(),
    supabaseAdmin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  return NextResponse.json({
    preferences: (prefs ?? []).map((p) => ({ category: p.category, channel: p.channel, enabled: p.enabled })),
    contact: contact ?? null,
    pushDevices: count ?? 0,
    pushConfigured: Boolean(process.env.VAPID_PUBLIC_KEY),
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  });
});

/**
 * PUT /api/account/notifications — saves channel switches for the reminders and messages categories
 * (essential messages cannot be switched off), the time zone and language, and SMS consent. SMS
 * consent needs a verified phone; the database enforces it as well.
 */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const input = NotificationSettingsSchema.parse(await request.json());

  if (input.preferences) {
    const rows = Object.entries(input.preferences).flatMap(([category, channels]) =>
      Object.entries(channels ?? {}).map(([channel, enabled]) => ({
        user_id: user.id,
        category: category as "reminders" | "messages",
        channel: channel as "email" | "sms" | "push",
        enabled: Boolean(enabled),
      }))
    );
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("notification_preferences").upsert(rows, { onConflict: "user_id,category,channel" });
      if (error) throw new Error(`preferences: ${error.message}`);
    }
  }

  const contactPatch: Record<string, unknown> = {};
  if (input.timezone) contactPatch.timezone = input.timezone;
  if (input.locale) contactPatch.locale = input.locale;
  if (input.sms_opt_in !== undefined) {
    const { data: existing } = await supabaseAdmin.from("contact_channels").select("phone_verified_at").eq("user_id", user.id).maybeSingle();
    if (input.sms_opt_in && !existing?.phone_verified_at) throw new ApiError(400, "Verify your phone number before turning on text messages.");
    contactPatch.sms_opt_in = input.sms_opt_in;
    contactPatch.sms_opt_in_at = input.sms_opt_in ? new Date().toISOString() : null;
  }
  if (Object.keys(contactPatch).length > 0) {
    const { error } = await supabaseAdmin.from("contact_channels").upsert({ user_id: user.id, ...contactPatch }, { onConflict: "user_id" });
    if (error) throw new Error(`contact: ${error.message}`);
  }
  return NextResponse.json({ ok: true });
});
