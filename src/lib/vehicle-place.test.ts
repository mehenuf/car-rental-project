import { describe, expect, it } from "vitest";
import { choosePlace, isTemplateDescription } from "./vehicle-place";

const branches = [{ id: 1, city: "Dhaka" }, { id: 2, city: "London" }, { id: 3, city: "Manchester" }];
const plan = (branch_id: number, currency: string, base_daily_minor: number) => ({ vehicle_id: "v", branch_id, currency, base_daily_minor });

describe("choosePlace", () => {
  it("prefers the branch the visitor is looking at", () => {
    const p = choosePlace([plan(1, "BDT", 500000), plan(2, "GBP", 4500), plan(3, "GBP", 4300)], branches, 2);
    expect(p).toEqual({ branchId: 2, city: "London", otherCities: 2, currency: "GBP", dailyMinor: 4500 });
  });
  it("otherwise takes the lowest branch id, and never mixes currencies", () => {
    const p = choosePlace([plan(3, "GBP", 4300), plan(2, "GBP", 4500)], branches);
    expect(p).toMatchObject({ branchId: 2, city: "London", currency: "GBP", dailyMinor: 4500, otherCities: 1 });
  });
  it("counts a city once and ignores plans for unknown branches", () => {
    const p = choosePlace([plan(2, "GBP", 1), plan(2, "GBP", 2), plan(99, "USD", 3)], branches);
    expect(p?.otherCities).toBe(0);
  });
  it("returns null with nothing to show", () => {
    expect(choosePlace([], branches)).toBeNull();
  });
});

describe("isTemplateDescription", () => {
  it("recognises the sample-data placeholder and empty text", () => {
    expect(isTemplateDescription("A reliable Honda Civic, well maintained and ready for your next trip.")).toBe(true);
    expect(isTemplateDescription("")).toBe(true);
    expect(isTemplateDescription(null)).toBe(true);
  });
  it("keeps text a host actually wrote", () => {
    expect(isTemplateDescription("One owner since 2021. Service history on request.")).toBe(false);
  });
});
