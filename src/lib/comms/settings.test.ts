import { describe, expect, it } from "vitest";
import { NotificationSettingsSchema, PushSubscriptionSchema, normalizePhone } from "./settings";

describe("normalizePhone", () => {
  it("keeps a valid E.164 number and strips formatting", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("+1 (555) 000-1111")).toBe("+15550001111");
  });
  it("rejects numbers without a country code or with junk", () => {
    expect(normalizePhone("07700 900123")).toBeNull();
    expect(normalizePhone("+0123456")).toBeNull();
    expect(normalizePhone("+44 abc")).toBeNull();
    expect(normalizePhone("+123")).toBeNull();
  });
});

describe("NotificationSettingsSchema", () => {
  it("accepts per-category channel switches", () => {
    const r = NotificationSettingsSchema.safeParse({ preferences: { reminders: { email: false, push: true }, messages: { email: true } } });
    expect(r.success).toBe(true);
  });
  it("rejects unknown categories or channels", () => {
    expect(NotificationSettingsSchema.safeParse({ preferences: { marketing: { email: true } } }).success).toBe(false);
    expect(NotificationSettingsSchema.safeParse({ preferences: { reminders: { fax: true } } }).success).toBe(false);
  });
  it("validates the time zone and language", () => {
    expect(NotificationSettingsSchema.safeParse({ timezone: "Europe/Amsterdam", locale: "nl" }).success).toBe(true);
    expect(NotificationSettingsSchema.safeParse({ timezone: "Mars/Base" }).success).toBe(false);
    expect(NotificationSettingsSchema.safeParse({ locale: "xx" }).success).toBe(false);
  });
});

describe("PushSubscriptionSchema", () => {
  it("requires an https endpoint and both keys", () => {
    expect(PushSubscriptionSchema.safeParse({ endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } }).success).toBe(true);
    expect(PushSubscriptionSchema.safeParse({ endpoint: "http://push.example/abc", keys: { p256dh: "k", auth: "a" } }).success).toBe(false);
    expect(PushSubscriptionSchema.safeParse({ endpoint: "https://push.example/abc", keys: { p256dh: "k" } }).success).toBe(false);
  });
});
