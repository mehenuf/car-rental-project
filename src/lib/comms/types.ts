import type { Locale } from "@/lib/i18n/locales";
import type { Params, TFunction } from "@/lib/i18n/t";
import type { Channel, ContactState } from "./preferences";

export type SendResult =
  | { ok: true; providerRef: string }
  | { ok: false; error: string; /** A bad address or revoked subscription: retrying will not help. */ permanent: boolean };

export interface EmailProvider {
  name: string;
  send(input: { to: string; subject: string; html: string; text: string }): Promise<SendResult>;
}

export interface SmsProvider {
  name: string;
  send(input: { to: string; body: string }): Promise<SendResult>;
}

export interface PushSubscriptionInfo {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushProvider {
  name: string;
  /** `gone` means the browser dropped the subscription (HTTP 404 or 410) and it should be deleted. */
  send(input: { subscription: PushSubscriptionInfo; title: string; body: string; url: string }): Promise<SendResult & { gone?: boolean }>;
}

export interface OutboxEvent {
  id: string;
  type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  locale: string;
  attempts: number;
}

export interface Recipient {
  userId: string | null;
  email: string;
  name: string;
  locale: Locale;
  timezone: string;
  phone: string | null;
  contact: ContactState;
  prefs: Record<string, boolean>;
  pushSubscriptions: PushSubscriptionInfo[];
  suppressed: Channel[];
  /** Where the "view" link points: the customer account or the provider portal. */
  area: "account" | "provider";
}

export interface NotificationRow {
  id: string;
  event_id: string | null;
  channel: Channel;
  template: string;
  recipient_user_id: string | null;
  address: string;
  locale: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface NewNotification {
  event_id: string;
  channel: Channel;
  template: string;
  recipient_user_id: string | null;
  address: string;
  locale: string;
  payload: Params;
  dedupe_key: string;
  next_attempt_at: string;
}

export interface NotificationPatch {
  status?: "queued" | "sent" | "failed" | "suppressed";
  provider?: string;
  provider_ref?: string;
  error?: string | null;
  sent_at?: string;
  next_attempt_at?: string;
}

/** Everything the dispatcher needs from the outside world, so it can be tested with fakes. */
export interface DispatchDeps {
  now(): Date;
  claimEvents(limit: number): Promise<OutboxEvent[]>;
  finishEvent(id: string, result: { status: "processed" | "failed" | "pending"; error?: string }): Promise<void>;
  recipientsFor(event: OutboxEvent): Promise<Recipient[]>;
  /** Inserts, ignoring rows whose dedupe key already exists. */
  insertNotifications(rows: NewNotification[]): Promise<void>;
  claimNotifications(limit: number): Promise<NotificationRow[]>;
  updateNotification(id: string, patch: NotificationPatch): Promise<void>;
  isSuppressed(channel: Channel, address: string): Promise<boolean>;
  timezoneFor(userId: string | null): Promise<string>;
  pushSubscriptionFor(userId: string | null, endpoint: string): Promise<PushSubscriptionInfo | null>;
  deletePushSubscription(endpoint: string): Promise<void>;
  translator(locale: Locale): Promise<TFunction>;
  /** Public site origin used to build the "view" link. */
  baseUrl: string;
  providers: { email: EmailProvider; sms: SmsProvider; push: PushProvider };
}
