import { describe, expect, it } from "vitest";
import { buildPriceScope, niceMax, priceStep } from "./price-scope";

describe("price scope", () => {
  it("picks a step that suits the size of the prices", () => {
    expect(priceStep(80)).toBe(5);
    expect(priceStep(300)).toBe(10);
    expect(priceStep(2600)).toBe(100);
    expect(priceStep(30000)).toBe(1000);
  });
  it("rounds the top of the slider up to a whole step, never below two steps", () => {
    expect(niceMax(263)).toBe(270);
    expect(niceMax(48)).toBe(50);
    expect(niceMax(1)).toBe(10);
    expect(niceMax(28400)).toBe(29000);
  });
  it("builds a scope from minor units", () => {
    expect(buildPriceScope("GBP", 21000, 2)).toEqual({ currency: "GBP", max: 210, step: 10 });
    expect(buildPriceScope("JPY", 30000, 0)).toEqual({ currency: "JPY", max: 30000, step: 1000 });
  });
});
