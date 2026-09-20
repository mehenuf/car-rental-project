import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createT, type Messages } from "@/lib/i18n/t";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { deepMerge } from "@/lib/i18n/merge";
import { SMS_TEMPLATES, TEMPLATE_NAMES, renderNotification } from "./render";

const load = (l: string) => JSON.parse(readFileSync(join(process.cwd(), "src/messages", `${l}.json`), "utf8")) as Messages;
const tFor = (locale: Locale) => createT(locale, deepMerge(load("en"), load(locale)));
const params = { name: "Sam", reference: "BC-1234", pickup: "5 Mar 2026", amount: "$80.00", link: "https://bestcar.example/en/account" };

describe("renderNotification", () => {
  it("renders an email with subject, html and plain text", () => {
    const out = renderNotification({ template: "booking_confirmed", channel: "email", locale: "en", params, t: tFor("en") });
    expect(out.subject).toBe("Booking confirmed: BC-1234");
    expect(out.text).toContain("Hello Sam,");
    expect(out.text).toContain("https://bestcar.example/en/account");
    expect(out.html).toContain("<html");
    expect(out.html).toContain('lang="en"');
    expect(out.html).toContain('dir="ltr"');
  });
  it("is right-to-left for Arabic", () => {
    const out = renderNotification({ template: "booking_confirmed", channel: "email", locale: "ar", params, t: tFor("ar") });
    expect(out.html).toContain('dir="rtl"');
    expect(out.subject).toContain("BC-1234");
  });
  it("escapes HTML in user-supplied values", () => {
    const out = renderNotification({
      template: "new_message", channel: "email", locale: "en",
      params: { ...params, name: '<script>alert("x")</script>' }, t: tFor("en"),
    });
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
  it("renders a short SMS without markup", () => {
    const out = renderNotification({ template: "pickup_reminder", channel: "sms", locale: "de", params, t: tFor("de") });
    expect(out.text).toContain("BC-1234");
    expect(out.text).toContain("STOP");
    expect(out.html).toBeNull();
    expect(out.text.length).toBeLessThan(200);
  });
  it("renders a push notification with a title and short body", () => {
    const out = renderNotification({ template: "new_message", channel: "push", locale: "en", params, t: tFor("en") });
    expect(out.subject).toBe("New message about booking BC-1234");
    expect(out.html).toBeNull();
  });
  it("has every template in every language, with no unresolved placeholders", () => {
    for (const locale of LOCALES) {
      for (const template of TEMPLATE_NAMES) {
        const out = renderNotification({ template, channel: "email", locale, params, t: tFor(locale) });
        expect(out.subject, `${locale}/${template}`).not.toMatch(/\{|email\./);
        expect(out.text, `${locale}/${template}`).not.toMatch(/\{\w+\}|email\.\w+/);
      }
      for (const template of SMS_TEMPLATES) {
        const out = renderNotification({ template, channel: "sms", locale, params, t: tFor(locale) });
        expect(out.text, `${locale}/sms/${template}`).not.toMatch(/\{\w+\}|sms\./);
      }
    }
  });
});
