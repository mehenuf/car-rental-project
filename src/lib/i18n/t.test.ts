import { describe, expect, it } from "vitest";
import { createT } from "./t";

const dict = {
  hello: "Hello {name}",
  nested: { deep: "Deep" },
  cars: { one: "{count} car", other: "{count} cars" },
  ar: { zero: "لا سيارات", one: "سيارة", two: "سيارتان", few: "{count} سيارات", many: "{count} سيارة", other: "{count} سيارة" },
  plain: "No params",
};

describe("createT", () => {
  const t = createT("en", dict);
  it("looks up nested keys and interpolates", () => {
    expect(t("nested.deep")).toBe("Deep");
    expect(t("hello", { name: "Sam" })).toBe("Hello Sam");
    expect(t("plain")).toBe("No params");
  });
  it("leaves unknown placeholders visible", () => {
    expect(t("hello")).toBe("Hello {name}");
  });
  it("returns the key when missing", () => {
    expect(t("nope.missing")).toBe("nope.missing");
    expect(t("nested")).toBe("nested");
  });
  it("picks plural forms by count", () => {
    expect(t("cars", { count: 1 })).toBe("1 car");
    expect(t("cars", { count: 3 })).toBe("3 cars");
    expect(t("cars", { count: 0 })).toBe("0 cars");
  });
  it("supports Arabic's six forms", () => {
    const ta = createT("ar", dict);
    expect(ta("ar", { count: 0 })).toBe("لا سيارات");
    expect(ta("ar", { count: 1 })).toBe("سيارة");
    expect(ta("ar", { count: 2 })).toBe("سيارتان");
    expect(ta("ar", { count: 3 })).toBe("3 سيارات");
    expect(ta("ar", { count: 11 })).toBe("11 سيارة");
    expect(ta("ar", { count: 100 })).toBe("100 سيارة");
  });
  it("uses one form for Japanese", () => {
    const tj = createT("ja", { cars: { other: "{count}台" } });
    expect(tj("cars", { count: 1 })).toBe("1台");
  });
  it("falls back to a fallback dictionary", () => {
    const tf = createT("de", { a: "A" }, { a: "x", b: "B" });
    expect(tf("a")).toBe("A");
    expect(tf("b")).toBe("B");
  });
  it("formats numbers in the locale", () => {
    const td = createT("de", { n: "{count} Autos" });
    expect(td("n", { count: 1234 })).toBe("1.234 Autos");
  });
});
