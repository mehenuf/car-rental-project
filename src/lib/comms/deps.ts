import "server-only";
import type { Locale } from "@/lib/i18n/locales";
import { hasLocale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { createT } from "@/lib/i18n/t";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Channel } from "./preferences";
import { createResendProvider, createTwilioProvider, logProviders } from "./providers";
import type { DispatchDeps, OutboxEvent, PushSubscriptionInfo, Recipient } from "./types";
import { createWebPushProvider } from "./webpush-provider";

/** Real providers when their keys are set, the console log provider otherwise. */
export function providersFromEnv(env: Record<string, string | undefined> = process.env): DispatchDeps["providers"] {
  const log = logProviders();
  return {
    email: env.RESEND_API_KEY
      ? createResendProvider({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM ?? "BestCar <onboarding@resend.dev>" })
      : log.email,
    sms:
      env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_MESSAGING_SERVICE_SID
        ? createTwilioProvider({
            accountSid: env.TWILIO_ACCOUNT_SID,
            authToken: env.TWILIO_AUTH_TOKEN,
            messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
          })
        : log.sms,
    push:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? createWebPushProvider({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT ?? "mailto:support@bestcar.example" })
        : log.push,
  };
}

async function loadRecipient(input: {
  userId: string | null;
  email: string;
  name: string;
  fallbackLocale: string;
  area: Recipient["area"];
}): Promise<Recipient> {
  const { userId, email } = input;
  const [contactRes, prefsRes, pushRes, supRes] = await Promise.all([
    userId ? supabaseAdmin.from("contact_channels").select("*").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    userId ? supabaseAdmin.from("notification_preferences").select("*").eq("user_id", userId) : Promise.resolve({ data: [] }),
    userId ? supabaseAdmin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("suppressions").select("channel, address").in("address", [email, ...(userId ? [] : [])]),
  ]);
  const contact = contactRes.data;
  const subs: PushSubscriptionInfo[] = (pushRes.data ?? []) as PushSubscriptionInfo[];
  const prefs: Record<string, boolean> = {};
  for (const p of prefsRes.data ?? []) prefs[`${p.category}:${p.channel}`] = p.enabled;

  const phone = contact?.phone_verified_at ? contact.phone_e164 : null;
  const suppressed = new Set<Channel>((supRes.data ?? []).filter((s) => s.channel === "email").map((s) => s.channel as Channel));
  if (phone) {
    const { data } = await supabaseAdmin.from("suppressions").select("channel").eq("channel", "sms").eq("address", phone);
    if ((data ?? []).length > 0) suppressed.add("sms");
  }

  const rawLocale = contact?.locale ?? input.fallbackLocale;
  return {
    userId,
    email,
    name: input.name,
    locale: hasLocale(rawLocale) ? rawLocale : "en",
    timezone: contact?.timezone ?? "UTC",
    phone,
    contact: {
      emailVerified: true,
      phoneVerified: Boolean(contact?.phone_verified_at),
      smsOptIn: Boolean(contact?.sms_opt_in),
      hasPushSubscription: subs.length > 0,
    },
    prefs,
    pushSubscriptions: subs,
    suppressed: [...suppressed],
    area: input.area,
  };
}

async function providerRecipients(providerId: string, event: OutboxEvent): Promise<Recipient[]> {
  const { data, error } = await supabaseAdmin.rpc("provider_recipients", { p_provider_id: providerId });
  if (error) throw new Error(`provider_recipients: ${error.message}`);
  return Promise.all(
    (data ?? []).map((r) => loadRecipient({ userId: r.user_id, email: r.email, name: "", fallbackLocale: event.locale, area: "provider" }))
  );
}

async function recipientsFor(event: OutboxEvent): Promise<Recipient[]> {
  const p = event.payload;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);

  switch (event.type) {
    case "booking_confirmed":
    case "booking_cancelled":
    case "refund_issued":
    case "pickup_reminder": {
      const email = str("email");
      if (!email) return [];
      return [await loadRecipient({ userId: str("user_id"), email, name: str("name") ?? "", fallbackLocale: event.locale, area: "account" })];
    }
    case "new_booking":
    case "booking_cancelled_provider":
    case "payout_paid": {
      const providerId = str("provider_id");
      return providerId ? providerRecipients(providerId, event) : [];
    }
    case "new_message": {
      if (p.to === "provider") {
        const providerId = str("provider_id");
        return providerId ? providerRecipients(providerId, event) : [];
      }
      const customerId = str("customer_user_id");
      if (!customerId) return [];
      const { data } = await supabaseAdmin.auth.admin.getUserById(customerId);
      const email = data.user?.email;
      if (!email) return [];
      return [await loadRecipient({ userId: customerId, email, name: (data.user?.user_metadata?.full_name as string | undefined) ?? "", fallbackLocale: event.locale, area: "account" })];
    }
    default:
      return [];
  }
}

export function dispatchDeps(): DispatchDeps {
  return {
    now: () => new Date(),
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ?? "http://localhost:3000",
    async claimEvents(limit) {
      const { data, error } = await supabaseAdmin.rpc("claim_pending_events", { p_limit: limit });
      if (error) throw new Error(`claim_pending_events: ${error.message}`);
      return (data ?? []) as OutboxEvent[];
    },
    async finishEvent(id, result) {
      const patch =
        result.status === "pending"
          ? { last_error: result.error ?? null }
          : { status: result.status, last_error: result.error ?? null, processed_at: new Date().toISOString() };
      const { error } = await supabaseAdmin.from("outbox_events").update(patch).eq("id", id);
      if (error) throw new Error(`finishEvent: ${error.message}`);
    },
    recipientsFor,
    async insertNotifications(rows) {
      const { error } = await supabaseAdmin.from("notifications").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (error) throw new Error(`insertNotifications: ${error.message}`);
    },
    async claimNotifications(limit) {
      const { data, error } = await supabaseAdmin.rpc("claim_due_notifications", { p_limit: limit });
      if (error) throw new Error(`claim_due_notifications: ${error.message}`);
      return (data ?? []).map((n) => ({
        id: n.id, event_id: n.event_id, channel: n.channel, template: n.template, recipient_user_id: n.recipient_user_id,
        address: n.address, locale: n.locale, payload: n.payload, attempts: n.attempts,
      }));
    },
    async updateNotification(id, patch) {
      const { error } = await supabaseAdmin.from("notifications").update(patch).eq("id", id);
      if (error) throw new Error(`updateNotification: ${error.message}`);
    },
    async isSuppressed(channel, address) {
      const { data } = await supabaseAdmin.from("suppressions").select("address").eq("channel", channel).eq("address", address).maybeSingle();
      return Boolean(data);
    },
    async timezoneFor(userId) {
      if (!userId) return "UTC";
      const { data } = await supabaseAdmin.from("contact_channels").select("timezone").eq("user_id", userId).maybeSingle();
      return data?.timezone ?? "UTC";
    },
    async pushSubscriptionFor(userId, endpoint) {
      if (!userId) return null;
      const { data } = await supabaseAdmin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
      return data ?? null;
    },
    async deletePushSubscription(endpoint) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
    },
    async translator(locale: Locale) {
      return createT(locale, await getMessages(locale), await getMessages("en"));
    },
    providers: providersFromEnv(),
  };
}
