import { describe, expect, it } from "vitest";
import { negotiateLocale, parseAcceptLanguage, stripLocale, withLocale } from "./negotiate";

describe("parseAcceptLanguage", () => {
  it("orders by quality and drops regions", () => {
    expect(parseAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.5")).toEqual(["fr", "fr", "en"]);
    expect(parseAcceptLanguage("en;q=0.2, de;q=0.9")).toEqual(["de", "en"]);
  });
  it("ignores garbage and q=0", () => {
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage("*, xx;q=0, ;;")).toEqual(["*"]);
  });
});

describe("negotiateLocale", () => {
  it("prefers the saved cookie over everything", () => {
    expect(negotiateLocale({ cookie: "ja", acceptLanguage: "de", country: "FR" })).toBe("ja");
  });
  it("ignores an unsupported cookie", () => {
    expect(negotiateLocale({ cookie: "xx", acceptLanguage: "de" })).toBe("de");
  });
  it("uses Accept-Language, matching the first supported entry", () => {
    expect(negotiateLocale({ acceptLanguage: "hi,zh-CN;q=0.8,en;q=0.5" })).toBe("zh");
    expect(negotiateLocale({ acceptLanguage: "pt-BR" })).toBe("pt");
  });
  it("falls back to the visitor country", () => {
    expect(negotiateLocale({ acceptLanguage: "hi", country: "nl" })).toBe("nl");
    expect(negotiateLocale({ country: "JP" })).toBe("ja");
  });
  it("defaults to English", () => {
    expect(negotiateLocale({})).toBe("en");
    expect(negotiateLocale({ acceptLanguage: "sw", country: "KE" })).toBe("en");
  });
});

describe("stripLocale / withLocale", () => {
  it("splits a prefixed path", () => {
    expect(stripLocale("/ar/cars/x")).toEqual({ locale: "ar", path: "/cars/x" });
    expect(stripLocale("/ar")).toEqual({ locale: "ar", path: "/" });
    expect(stripLocale("/cars")).toEqual({ locale: null, path: "/cars" });
    expect(stripLocale("/arabic")).toEqual({ locale: null, path: "/arabic" });
  });
  it("prefixes and replaces", () => {
    expect(withLocale("de", "/cars")).toBe("/de/cars");
    expect(withLocale("de", "/")).toBe("/de");
    expect(withLocale("de", "/#how-it-works")).toBe("/de#how-it-works");
    expect(withLocale("de", "/cars?x=1")).toBe("/de/cars?x=1");
    expect(withLocale("de", "/fr/cars")).toBe("/de/cars");
  });
  it("leaves private, api and external targets alone", () => {
    expect(withLocale("de", "/admin/login")).toBe("/admin/login");
    expect(withLocale("de", "/provider")).toBe("/provider");
    expect(withLocale("de", "/api/quote")).toBe("/api/quote");
    expect(withLocale("de", "https://x.com/a")).toBe("https://x.com/a");
    expect(withLocale("de", "#top")).toBe("#top");
  });
});
