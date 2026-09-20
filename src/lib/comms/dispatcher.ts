import type { Locale } from "@/lib/i18n/locales";
import type { Params } from "@/lib/i18n/t";
import { buildParams } from "./params";
import { resolveChannels, type Channel } from "./preferences";
import { isQuietHour, nextAllowedTime } from "./quiet-hours";
import { renderNotification } from "./render";
import { MAX_ATTEMPTS, dedupeKey, nextAttemptAt } from "./retry";
import type { DispatchDeps, NewNotification, NotificationRow, Recipient } from "./types";

const BATCH = 20;

function addressFor(channel: Channel, recipient: Recipient): string | null {
  if (channel === "email") return recipient.email;
  if (channel === "sms") return recipient.phone;
  return recipient.pushSubscriptions[0]?.endpoint ?? null;
}

/** Turns due outbox events into per-channel notifications. Returns how many events were handled. */
export async function processEvents(deps: DispatchDeps): Promise<number> {
  const events = await deps.claimEvents(BATCH);
  for (const event of events) {
    try {
      const recipients = await deps.recipientsFor(event);
      const rows: NewNotification[] = [];
      for (const recipient of recipients) {
        const channels = resolveChannels({
          template: event.type,
          contact: recipient.contact,
          prefs: recipient.prefs,
          suppressed: recipient.suppressed,
        });
        const params = buildParams(event, recipient, deps.baseUrl);
        for (const channel of channels) {
          if (channel === "push") {
            // One notification per subscribed device.
            for (const sub of recipient.pushSubscriptions) {
              rows.push(newRow(event.id, event.type, channel, sub.endpoint, recipient, params, deps.now()));
            }
            continue;
          }
          const address = addressFor(channel, recipient);
          if (address) rows.push(newRow(event.id, event.type, channel, address, recipient, params, deps.now()));
        }
      }
      if (rows.length > 0) await deps.insertNotifications(rows);
      await deps.finishEvent(event.id, { status: "processed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.finishEvent(event.id, { status: event.attempts >= MAX_ATTEMPTS ? "failed" : "pending", error: message });
    }
  }
  return events.length;
}

function newRow(
  eventId: string,
  template: string,
  channel: Channel,
  address: string,
  recipient: Recipient,
  params: Params,
  now: Date
): NewNotification {
  // SMS and push wait for a reasonable hour in the recipient's own time zone.
  const at = channel === "email" ? now : nextAllowedTime(now, recipient.timezone);
  return {
    event_id: eventId,
    channel,
    template,
    recipient_user_id: recipient.userId,
    address,
    locale: recipient.locale,
    payload: params,
    dedupe_key: dedupeKey(eventId, channel, address, template),
    next_attempt_at: at.toISOString(),
  };
}

/** Sends due notifications, recording the outcome and scheduling retries. Returns how many were attempted. */
export async function sendDue(deps: DispatchDeps): Promise<number> {
  const rows = await deps.claimNotifications(BATCH);
  for (const row of rows) await sendOne(deps, row);
  return rows.length;
}

async function sendOne(deps: DispatchDeps, row: NotificationRow): Promise<void> {
  const now = deps.now();

  if (await deps.isSuppressed(row.channel, row.address)) {
    await deps.updateNotification(row.id, { status: "suppressed" });
    return;
  }

  // The recipient's clock may have moved into quiet hours since the notification was queued.
  if (row.channel !== "email") {
    const tz = await deps.timezoneFor(row.recipient_user_id);
    if (isQuietHour(now, tz)) {
      await deps.updateNotification(row.id, { next_attempt_at: nextAllowedTime(now, tz).toISOString() });
      return;
    }
  }

  const locale = row.locale as Locale;
  const t = await deps.translator(locale);
  const params = row.payload as Params;
  const rendered = renderNotification({ template: row.template, channel: row.channel, locale, params, t });

  let result;
  let provider: string;
  try {
    if (row.channel === "email") {
      provider = deps.providers.email.name;
      result = await deps.providers.email.send({ to: row.address, subject: rendered.subject, html: rendered.html ?? "", text: rendered.text });
    } else if (row.channel === "sms") {
      provider = deps.providers.sms.name;
      result = await deps.providers.sms.send({ to: row.address, body: rendered.text });
    } else {
      provider = deps.providers.push.name;
      const subscription = await deps.pushSubscriptionFor(row.recipient_user_id, row.address);
      if (!subscription) {
        await deps.updateNotification(row.id, { status: "suppressed", error: "subscription removed" });
        return;
      }
      const link = typeof params.link === "string" ? params.link : "/";
      const pushResult = await deps.providers.push.send({ subscription, title: rendered.subject, body: rendered.text, url: link });
      if (!pushResult.ok && pushResult.gone) {
        await deps.deletePushSubscription(row.address);
        await deps.updateNotification(row.id, { status: "suppressed", error: "subscription gone" });
        return;
      }
      result = pushResult;
    }
  } catch (err) {
    result = { ok: false as const, error: err instanceof Error ? err.message : String(err), permanent: false };
    provider = row.channel;
  }

  if (result.ok) {
    await deps.updateNotification(row.id, { status: "sent", provider, provider_ref: result.providerRef, error: null, sent_at: now.toISOString() });
    return;
  }

  const retryAt = result.permanent ? null : nextAttemptAt(now, row.attempts);
  if (retryAt) {
    await deps.updateNotification(row.id, { error: result.error, provider, next_attempt_at: retryAt.toISOString() });
  } else {
    await deps.updateNotification(row.id, { status: "failed", error: result.error, provider });
  }
}

/** One dispatcher pass: events become notifications, then due notifications are sent. */
export async function dispatchAll(deps: DispatchDeps): Promise<{ events: number; sent: number }> {
  const events = await processEvents(deps);
  const sent = await sendDue(deps);
  return { events, sent };
}
