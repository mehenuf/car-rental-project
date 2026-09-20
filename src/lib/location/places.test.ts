import { describe, expect, it } from "vitest";
import { groupByCountry, highlightParts, normalize, pickDefaultPlace, placeLabel, scorePlace, searchPlaces, type Place } from "./places";

const places: Place[] = [
  { id: 1, name: "London Victoria", city: "London", country: "United Kingdom", country_code: "GB" },
  { id: 2, name: "Manchester Piccadilly", city: "Manchester", country: "United Kingdom", country_code: "GB" },
  { id: 3, name: "Sao Paulo Branch", city: "São Paulo", country: "Brazil", country_code: "BR" },
  { id: 4, name: "Dhaka Branch", city: "Dhaka", country: "Bangladesh", country_code: "BD" },
  { id: 5, name: "Gulshan pick-up", city: "Dhaka", country: "Bangladesh", country_code: "BD" },
];

describe("places search", () => {
  it("ignores accents and case", () => {
    expect(normalize("  São   PAULO ")).toBe("sao paulo");
    expect(searchPlaces(places, "sao")[0]?.id).toBe(3);
  });
  it("ranks exact and prefix city matches first", () => {
    expect(scorePlace(places[0]!, "london")).toBe(100);
    expect(scorePlace(places[0]!, "lon")).toBe(90);
    expect(searchPlaces(places, "dha").map((p) => p.id)).toEqual([4, 5]);
  });
  it("matches branch names and countries", () => {
    expect(searchPlaces(places, "gulshan").map((p) => p.id)).toEqual([5]);
    expect(searchPlaces(places, "brazil").map((p) => p.id)).toEqual([3]);
    expect(searchPlaces(places, "gb").map((p) => p.id).sort()).toEqual([1, 2]);
  });
  it("returns nothing for a query that matches nothing, and everything for an empty one", () => {
    expect(searchPlaces(places, "zzz")).toEqual([]);
    expect(searchPlaces(places, "")).toHaveLength(5);
  });
  it("groups by country in the given order", () => {
    const groups = groupByCountry(searchPlaces(places, ""));
    expect(groups.map((g) => g.country_code)).toEqual(["BD", "BR", "GB"]);
    expect(groups[2]!.places).toHaveLength(2);
  });
});

describe("pickDefaultPlace", () => {
  it("prefers the visitor's city, then their country, then the first place", () => {
    expect(pickDefaultPlace(places, { country: "GB", city: "Manchester" })?.id).toBe(2);
    expect(pickDefaultPlace(places, { country: "gb", city: "Leeds" })?.id).toBe(1);
    expect(pickDefaultPlace(places, { country: "FR" })?.id).toBe(1);
    expect(pickDefaultPlace([], { country: "GB" })).toBeNull();
  });
});

describe("labels and highlighting", () => {
  it("adds the branch name only when it says more than the city", () => {
    expect(placeLabel(places[0]!)).toBe("London Victoria");
    expect(placeLabel(places[4]!)).toBe("Gulshan pick-up, Dhaka");
    expect(placeLabel({ id: 9, city: "Lagos", country: "Nigeria", country_code: "NG" })).toBe("Lagos");
  });
  it("splits text around the match", () => {
    expect(highlightParts("Manchester", "chest")).toEqual([
      { text: "Man", match: false },
      { text: "chest", match: true },
      { text: "er", match: false },
    ]);
    expect(highlightParts("Dhaka", "")).toEqual([{ text: "Dhaka", match: false }]);
  });
});
