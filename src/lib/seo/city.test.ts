import { describe, expect, it } from "vitest";
import { branchesInCity, citySlug } from "./city";

describe("city slugs", () => {
  it("makes url-safe slugs", () => {
    expect(citySlug("Dhaka")).toBe("dhaka");
    expect(citySlug("São Paulo")).toBe("sao-paulo");
    expect(citySlug("  New  York! ")).toBe("new-york");
  });
  it("finds every branch in a city", () => {
    const list = [{ id: 1, city: "Dhaka" }, { id: 2, city: "Dhaka" }, { id: 3, city: "Berlin" }];
    expect(branchesInCity(list, "dhaka").map((b) => b.id)).toEqual([1, 2]);
    expect(branchesInCity(list, "paris")).toEqual([]);
  });
});
