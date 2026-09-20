import { describe, expect, it } from "vitest";
import { dedupeKey, MAX_ATTEMPTS, nextAttemptAt } from "./retry";
import { resolveChannels, isEssential } from "./preferences";
import { moderateMessage } from "./moderation";

describe("dedupeKey", () => {
  it("is stable and differs by any part", () => {
    const a = dedupeKey("evt1", "email", "a@example.com", "booking_confirmed");
    expect(a).toBe(dedupeKey("evt1", "email", "a@example.com", "booking_confirmed"));
    expect(a).not.toBe(dedupeKey("evt2", "email", "a@example.com", "booking_confirmed"));
    expect(a).not.toBe(dedupeKey("evt1", "sms", "a@example.com", "booking_confirmed"));
    expect(a).not.toBe(dedupeKey("evt1", "email", "b@example.com", "booking_confirmed"));
    expect(a).not.toBe(dedupeKey("evt1", "email", "a@example.com", "booking_cancelled"));
  });
  it("normalises the address", () => {
    expect(dedupeKey("e", "email", " A@Example.com ", "t")).toBe(dedupeKey("e", "email", "a@example.com", "t"));
  });
});

describe("nextAttemptAt", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("backs off 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours", () => {
    const minutes = [1, 2, 3, 4, 5].map((n) => (nextAttemptAt(now, n)!.getTime() - now.getTime()) / 60000);
    expect(minutes).toEqual([1, 5, 30, 120, 720]);
  });
  it("gives up after the last attempt", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(nextAttemptAt(now, 6)).toBeNull();
  });
});

describe("resolveChannels", () => {
  const contact = { emailVerified: true, phoneVerified: true, smsOptIn: true, hasPushSubscription: true };
  const noPrefs: Record<string, boolean> = {};

  it("essential messages always go by email and cannot be turned off", () => {
    expect(isEssential("booking_confirmed")).toBe(true);
    const channels = resolveChannels({ template: "booking_confirmed", contact, prefs: { "reminders:email": false, "messages:email": false }, suppressed: [] });
    expect(channels).toContain("email");
  });
  it("sends SMS only for the three SMS templates, and only with opt-in and a verified phone", () => {
    expect(resolveChannels({ template: "pickup_reminder", contact, prefs: noPrefs, suppressed: [] })).toContain("sms");
    expect(resolveChannels({ template: "new_message", contact, prefs: noPrefs, suppressed: [] })).not.toContain("sms");
    expect(resolveChannels({ template: "pickup_reminder", contact: { ...contact, smsOptIn: false }, prefs: noPrefs, suppressed: [] })).not.toContain("sms");
    expect(resolveChannels({ template: "pickup_reminder", contact: { ...contact, phoneVerified: false }, prefs: noPrefs, suppressed: [] })).not.toContain("sms");
  });
  it("switchable messages respect the per-channel preference", () => {
    expect(resolveChannels({ template: "pickup_reminder", contact, prefs: { "reminders:email": false }, suppressed: [] })).not.toContain("email");
    expect(resolveChannels({ template: "new_message", contact, prefs: { "messages:email": false }, suppressed: [] })).not.toContain("email");
  });
  it("push needs a subscription and a switched-on category", () => {
    expect(resolveChannels({ template: "new_message", contact, prefs: { "messages:push": true }, suppressed: [] })).toContain("push");
    expect(resolveChannels({ template: "new_message", contact: { ...contact, hasPushSubscription: false }, prefs: { "messages:push": true }, suppressed: [] })).not.toContain("push");
  });
  it("never sends to a suppressed channel", () => {
    expect(resolveChannels({ template: "booking_confirmed", contact, prefs: noPrefs, suppressed: ["email"] })).not.toContain("email");
    expect(resolveChannels({ template: "pickup_reminder", contact, prefs: noPrefs, suppressed: ["sms"] })).not.toContain("sms");
  });
});

describe("moderateMessage", () => {
  it("allows normal messages", () => {
    expect(moderateMessage("Hi, I will arrive around 10am. Is there parking?", { paid: false })).toEqual({ ok: true, flagged: false, reason: null });
  });
  it("blocks off-platform payment requests", () => {
    expect(moderateMessage("Please send the money by Western Union", { paid: true }).ok).toBe(false);
    expect(moderateMessage("Pay me on paypal.me/xyz to save the fee", { paid: true }).ok).toBe(false);
    expect(moderateMessage("Send a bank transfer directly", { paid: true }).ok).toBe(false);
  });
  it("blocks contact details before payment and flags links after it", () => {
    expect(moderateMessage("Call me on +44 7700 900123", { paid: false }).ok).toBe(false);
    expect(moderateMessage("Email me at bob@example.com", { paid: false }).ok).toBe(false);
    expect(moderateMessage("Call me on +44 7700 900123", { paid: true }).ok).toBe(true);
    const link = moderateMessage("See https://example.com/map", { paid: true });
    expect(link).toEqual({ ok: true, flagged: true, reason: "link" });
  });
  it("rejects empty and oversized messages", () => {
    expect(moderateMessage("   ", { paid: true }).ok).toBe(false);
    expect(moderateMessage("x".repeat(2001), { paid: true }).ok).toBe(false);
  });
});
