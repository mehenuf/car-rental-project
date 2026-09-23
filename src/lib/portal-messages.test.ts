import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { createT } from "@/lib/i18n/t";

// The host portal builds some translation keys from data (a booking's status, a car's listing state), so a missing
// entry would show the raw key to a host. This lists every value those keys can take.
const DYNAMIC_KEYS = [
  ...["pending", "confirmed", "active", "completed", "cancelled", "no_show"].map((s) => `portal.status.${s}`),
  ...["unpaid", "paid", "refunded", "partially_refunded"].map((s) => `portal.payment.${s}`),
  ...["viewUpcoming", "viewActive", "viewPast", "viewAll", "fuelEmpty", "fuelFull"].map((k) => `portal.bookings.${k}`),
  ...["statusActive", "statusMaintenance", "statusRetired", "listingDraft", "listingPending", "listingLive", "listingRejected"].map((k) => `portal.fleet.${k}`),
  ...["statusScheduled", "statusPaid", "statusHold", "statusCancelled"].map((k) => `portal.payouts.${k}`),
  ...["stateFree", "stateBooking", "stateTransfer", "stateMaintenance", "stateOwnerBlock", "stateUnavailable"].map((k) => `portal.calendar.${k}`),
  ...["tabPrices", "tabExtras", "tabPolicy", "tabPromos", "tabOneWay", "perDay", "perRental"].map((k) => `portal.pricing.${k}`),
];

describe("host portal translations", () => {
  it("has every data-driven key in every language, with none falling back to the key", async () => {
    for (const locale of LOCALES) {
      const t = createT(locale, await getMessages(locale));
      for (const key of DYNAMIC_KEYS) {
        const text = t(key);
        expect(text, `${locale} ${key}`).not.toBe(key);
        expect(text.length, `${locale} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("fills the placeholders the components pass", async () => {
    const t = createT("de", await getMessages("de"));
    expect(t("portal.payouts.ending", { bank: "Sparkasse", last4: "4242" })).toBe("Sparkasse mit Endziffern 4242");
    expect(t("portal.fleet.docsTitle", { name: "Golf" })).toContain("Golf");
    expect(t("portal.bookings.photosReady", { count: 3 })).toContain("3");
    expect(t("portal.calendar.cellLabel", { plate: "B-XY 12", date: "2026-05-01", state: "Frei" })).toContain("B-XY 12");
    expect(t("portal.pricing.seasonLine", { from: "2026-06-01", to: "2026-08-31", price: "99,00" })).toContain("99,00");
  });
});
