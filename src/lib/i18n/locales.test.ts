import { describe, expect, it } from "vitest";
import {
  COUNTRY_DEFAULT_LANGUAGE,
  DEFAULT_LOCALE,
  LOCALES,
  directionOf,
  hasLocale,
  numberingLocale,
} from "./locales";
import { COUNTRIES } from "@/lib/provider/countries";

describe("locales", () => {
  it("supports the eleven agreed languages", () => {
    expect([...LOCALES].sort()).toEqual(
      ["ar", "bn", "de", "en", "es", "fr", "id", "ja", "nl", "pt", "zh"].sort()
    );
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("narrows unknown strings", () => {
    expect(hasLocale("nl")).toBe(true);
    expect(hasLocale("hi")).toBe(false);
    expect(hasLocale("en-XA")).toBe(false);
  });

  it("only Arabic is right-to-left", () => {
    expect(LOCALES.filter((l) => directionOf(l) === "rtl")).toEqual(["ar"]);
  });

  it("uses Western digits for Arabic", () => {
    expect(numberingLocale("ar")).toBe("ar-u-nu-latn");
    expect(numberingLocale("de")).toBe("de");
  });

  it("maps every served country to a supported language", () => {
    for (const c of COUNTRIES) {
      const lang = COUNTRY_DEFAULT_LANGUAGE[c.code];
      expect(lang, c.code).toBeDefined();
      expect(hasLocale(lang!), c.code).toBe(true);
    }
    expect(COUNTRY_DEFAULT_LANGUAGE.NL).toBe("nl");
    expect(COUNTRY_DEFAULT_LANGUAGE.DE).toBe("de");
    expect(COUNTRY_DEFAULT_LANGUAGE.ID).toBe("id");
    expect(COUNTRY_DEFAULT_LANGUAGE.IN).toBe("en");
    expect(COUNTRY_DEFAULT_LANGUAGE.KE).toBe("en");
  });
});
