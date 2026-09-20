import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createT, type Messages } from "@/lib/i18n/t";
import { describeCancellationT, quoteLineLabel } from "./localize";
import type { QuoteLine } from "./types";

const load = (l: string) => JSON.parse(readFileSync(join(process.cwd(), "src/messages", `${l}.json`), "utf8")) as Messages;
const en = createT("en", load("en"));
const de = createT("de", load("de"));

const line = (over: Partial<QuoteLine>): QuoteLine => ({ kind: "base", label: "x", amountMinor: 1, ...over });

describe("quoteLineLabel", () => {
  it("keeps the engine's English text in English", () => {
    expect(quoteLineLabel(line({ kind: "base", label: "Base rate (3 days)" }), 3, en)).toBe("Base rate (3 days)");
    expect(quoteLineLabel(line({ kind: "base" }), 1, en)).toBe("Base rate (1 day)");
    expect(quoteLineLabel(line({ kind: "service_fee" }), 3, en)).toBe("Service fee");
    expect(quoteLineLabel(line({ kind: "promo", code: "SAVE10" }), 3, en)).toBe("Promo SAVE10");
  });
  it("translates known kinds", () => {
    expect(quoteLineLabel(line({ kind: "base" }), 3, de)).toBe("Grundpreis (3 Tage)");
    expect(quoteLineLabel(line({ kind: "weekend" }), 3, de)).toBe("Wochenendtarif");
    expect(quoteLineLabel(line({ kind: "one_way" }), 3, de)).toBe("Einweggebühr");
    expect(quoteLineLabel(line({ kind: "young_driver" }), 2, de)).toBe("Junge-Fahrer-Gebühr (2 Tage)");
  });
  it("chooses weekly or monthly from the rental length", () => {
    expect(quoteLineLabel(line({ kind: "duration_discount" }), 7, en)).toBe("Weekly discount");
    expect(quoteLineLabel(line({ kind: "duration_discount" }), 28, en)).toBe("Monthly discount");
  });
  it("leaves provider-defined names (extras, taxes) as entered, translating only the included marker", () => {
    expect(quoteLineLabel(line({ kind: "extra", label: "Child seat x 2" }), 3, de)).toBe("Child seat x 2");
    expect(quoteLineLabel(line({ kind: "tax", label: "VAT (included)", included: true }), 3, de)).toBe("VAT (inklusive)");
    expect(quoteLineLabel(line({ kind: "tax", label: "VAT" }), 3, de)).toBe("VAT");
  });
});

describe("describeCancellationT", () => {
  it("describes tiers in the language", () => {
    const tiers = [
      { hoursBefore: 48, refundBp: 10000 },
      { hoursBefore: 24, refundBp: 5000 },
      { hoursBefore: 0, refundBp: 0 },
    ];
    expect(describeCancellationT(tiers, en)).toEqual([
      "Free cancellation up to 48 hours before pick-up",
      "50% refund up to 24 hours before pick-up",
      "No refund after that",
    ]);
    expect(describeCancellationT(tiers, de)[0]).toBe("Kostenlose Stornierung bis 48 Stunden vor der Abholung");
    expect(describeCancellationT([], en)).toEqual(["Cancellation terms are set by the rental company."]);
  });
  it("uses the singular hour", () => {
    expect(describeCancellationT([{ hoursBefore: 1, refundBp: 10000 }], en)[0]).toBe("Free cancellation up to 1 hour before pick-up");
  });
});
