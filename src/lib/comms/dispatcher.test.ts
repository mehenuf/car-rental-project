import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createT, type Messages } from "@/lib/i18n/t";
import { deepMerge } from "@/lib/i18n/merge";
import type { Locale } from "@/lib/i18n/locales";
import { dispatchAll, processEvents, sendDue } from "./dispatcher";
import type { DispatchDeps, NewNotification, NotificationPatch, NotificationRow, OutboxEvent, Recipient, SendResult } from "./types";

const load = (l: string) => JSON.parse(readFileSync(join(process.cwd(), "src/messages", `${l}.json`), "utf8")) as Messages;

function recipient(over: Partial<Recipient> = {}): Recipient {
  return {
    userId: "user-1", email: "sam@example.com", name: "Sam", locale: "en", timezone: "UTC", phone: "+15550001111",
    contact: { emailVerified: true, phoneVerified: true, smsOptIn: true, hasPushSubscription: false },
    prefs: {}, pushSubscriptions: [], suppressed: [], area: "account", ...over,
  };
}

function event(over: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: "evt-1", type: "booking_confirmed", aggregate_type: "booking", aggregate_id: "b1",
    payload: { reference: "BC-1", pickup_at: "2026-10-10T10:00:00Z", user_id: "user-1", email: "sam@example.com" },
    locale: "en", attempts: 1, ...over,
  };
}

function harness(opts: { now?: string; events?: OutboxEvent[]; recipients?: Recipient[]; email?: () => Promise<SendResult>; sms?: () => Promise<SendResult>; suppressed?: string[] } = {}) {
  const now = new Date(opts.now ?? "2026-10-01T12:00:00Z");
  const state = {
    events: opts.events ?? [],
    finished: [] as { id: string; status: string }[],
    notifications: [] as (NotificationRow & { status: string; dedupe: string; next_attempt_at: string })[],
    patches: [] as { id: string; patch: NotificationPatch }[],
    emailsSent: [] as { to: string; subject: string }[],
    smsSent: [] as { to: string; body: string }[],
    deletedPush: [] as string[],
  };
  const deps: DispatchDeps = {
    now: () => now,
    baseUrl: "https://bestcar.example",
    claimEvents: async () => state.events,
    finishEvent: async (id, r) => void state.finished.push({ id, status: r.status }),
    recipientsFor: async () => opts.recipients ?? [recipient()],
    insertNotifications: async (rows: NewNotification[]) => {
      for (const r of rows) {
        if (state.notifications.some((n) => n.dedupe === r.dedupe_key)) continue;
        state.notifications.push({ id: `n${state.notifications.length + 1}`, event_id: r.event_id, channel: r.channel, template: r.template,
          recipient_user_id: r.recipient_user_id, address: r.address, locale: r.locale, payload: r.payload, attempts: 0,
          status: "queued", dedupe: r.dedupe_key, next_attempt_at: r.next_attempt_at });
      }
    },
    claimNotifications: async () => state.notifications.filter((n) => n.status === "queued").map((n) => ({ ...n, attempts: n.attempts + 1 })),
    updateNotification: async (id, patch) => {
      state.patches.push({ id, patch });
      const n = state.notifications.find((x) => x.id === id)!;
      if (patch.status) n.status = patch.status;
      n.attempts += 1;
    },
    isSuppressed: async (_c, address) => (opts.suppressed ?? []).includes(address),
    timezoneFor: async () => "UTC",
    pushSubscriptionFor: async (_u, endpoint) => ({ endpoint, p256dh: "k", auth: "a" }),
    deletePushSubscription: async (e) => void state.deletedPush.push(e),
    translator: async (locale: Locale) => createT(locale, deepMerge(load("en"), load(locale))),
    providers: {
      email: { name: "fake-email", send: async (i) => { state.emailsSent.push({ to: i.to, subject: i.subject }); return opts.email ? opts.email() : { ok: true, providerRef: "e1" }; } },
      sms: { name: "fake-sms", send: async (i) => { state.smsSent.push({ to: i.to, body: i.body }); return opts.sms ? opts.sms() : { ok: true, providerRef: "s1" }; } },
      push: { name: "fake-push", send: async () => ({ ok: true, providerRef: "p1" }) },
    },
  };
  return { deps, state };
}

describe("processEvents", () => {
  it("creates an email and an SMS for a confirmed booking when the customer opted in", async () => {
    const h = harness({ events: [event()] });
    await processEvents(h.deps);
    expect(h.state.notifications.map((n) => n.channel).sort()).toEqual(["email", "sms"]);
    expect(h.state.finished).toEqual([{ id: "evt-1", status: "processed" }]);
  });
  it("is idempotent: the same event twice creates no duplicates", async () => {
    const h = harness({ events: [event()] });
    await processEvents(h.deps);
    await processEvents(h.deps);
    expect(h.state.notifications).toHaveLength(2);
  });
  it("holds SMS until morning in the recipient's time zone but sends email now", async () => {
    const h = harness({ now: "2026-10-01T22:00:00Z", events: [event()] });
    await processEvents(h.deps);
    const email = h.state.notifications.find((n) => n.channel === "email")!;
    const sms = h.state.notifications.find((n) => n.channel === "sms")!;
    expect(email.next_attempt_at).toBe("2026-10-01T22:00:00.000Z");
    expect(sms.next_attempt_at).toBe("2026-10-02T08:00:00.000Z");
  });
  it("skips suppressed channels", async () => {
    const h = harness({ events: [event()], recipients: [recipient({ suppressed: ["sms"] })] });
    await processEvents(h.deps);
    expect(h.state.notifications.map((n) => n.channel)).toEqual(["email"]);
  });
  it("leaves the event pending for a retry when the recipient lookup fails", async () => {
    const h = harness({ events: [event()] });
    h.deps.recipientsFor = async () => { throw new Error("db down"); };
    await processEvents(h.deps);
    expect(h.state.finished).toEqual([{ id: "evt-1", status: "pending" }]);
  });
  it("gives up on an event that keeps failing", async () => {
    const h = harness({ events: [event({ attempts: 5 })] });
    h.deps.recipientsFor = async () => { throw new Error("db down"); };
    await processEvents(h.deps);
    expect(h.state.finished).toEqual([{ id: "evt-1", status: "failed" }]);
  });
  it("sends a device push only to subscribed devices with the category on", async () => {
    const r = recipient({ contact: { emailVerified: true, phoneVerified: false, smsOptIn: false, hasPushSubscription: true },
      prefs: { "messages:push": true }, pushSubscriptions: [{ endpoint: "https://push/1", p256dh: "k", auth: "a" }, { endpoint: "https://push/2", p256dh: "k", auth: "a" }] });
    const h = harness({ events: [event({ type: "new_message" })], recipients: [r] });
    await processEvents(h.deps);
    expect(h.state.notifications.filter((n) => n.channel === "push")).toHaveLength(2);
  });
});

describe("sendDue", () => {
  it("sends an email in the recipient's language and records it", async () => {
    const h = harness({ events: [event()], recipients: [recipient({ locale: "de", contact: { emailVerified: true, phoneVerified: false, smsOptIn: false, hasPushSubscription: false } })] });
    await processEvents(h.deps);
    await sendDue(h.deps);
    expect(h.state.emailsSent).toEqual([{ to: "sam@example.com", subject: "Buchung bestätigt: BC-1" }]);
    expect(h.state.patches[0]!.patch).toMatchObject({ status: "sent", provider: "fake-email", provider_ref: "e1" });
  });
  it("retries a temporary failure with backoff and does not mark it failed", async () => {
    const h = harness({ events: [event()], email: async () => ({ ok: false, error: "timeout", permanent: false }) });
    await processEvents(h.deps);
    await sendDue(h.deps);
    const patch = h.state.patches.find((p) => p.patch.error === "timeout")!.patch;
    expect(patch.status).toBeUndefined();
    expect(patch.next_attempt_at).toBe("2026-10-01T12:01:00.000Z");
  });
  it("fails permanently on a bad address", async () => {
    const h = harness({ events: [event()], email: async () => ({ ok: false, error: "invalid address", permanent: true }) });
    await processEvents(h.deps);
    await sendDue(h.deps);
    expect(h.state.patches.some((p) => p.patch.status === "failed")).toBe(true);
  });
  it("treats a provider that throws as a temporary failure", async () => {
    const h = harness({ events: [event()], email: async () => { throw new Error("boom"); } });
    await processEvents(h.deps);
    await sendDue(h.deps);
    expect(h.state.patches.some((p) => p.patch.error === "boom" && p.patch.status === undefined)).toBe(true);
  });
  it("marks suppressed addresses instead of sending", async () => {
    const h = harness({ events: [event()], suppressed: ["sam@example.com"] });
    await processEvents(h.deps);
    await sendDue(h.deps);
    expect(h.state.emailsSent).toHaveLength(0);
    expect(h.state.patches.some((p) => p.patch.status === "suppressed")).toBe(true);
  });
  it("defers SMS that comes due during quiet hours", async () => {
    const h = harness({ now: "2026-10-01T12:00:00Z", events: [event()] });
    await processEvents(h.deps);
    h.deps.now = () => new Date("2026-10-01T22:30:00Z");
    await sendDue(h.deps);
    expect(h.state.smsSent).toHaveLength(0);
    expect(h.state.patches.some((p) => p.patch.next_attempt_at === "2026-10-02T08:00:00.000Z")).toBe(true);
  });
  it("deletes a push subscription the browser has dropped", async () => {
    const r = recipient({ contact: { emailVerified: true, phoneVerified: false, smsOptIn: false, hasPushSubscription: true }, prefs: { "messages:push": true }, pushSubscriptions: [{ endpoint: "https://push/1", p256dh: "k", auth: "a" }] });
    const h = harness({ events: [event({ type: "new_message" })], recipients: [r] });
    h.deps.providers.push = { name: "fake-push", send: async () => ({ ok: false, error: "gone", permanent: true, gone: true }) };
    await processEvents(h.deps);
    await sendDue(h.deps);
    expect(h.state.deletedPush).toEqual(["https://push/1"]);
  });
});

describe("dispatchAll", () => {
  it("runs both stages", async () => {
    const h = harness({ events: [event()] });
    const result = await dispatchAll(h.deps);
    expect(result).toEqual({ events: 1, sent: 2 });
  });
});
