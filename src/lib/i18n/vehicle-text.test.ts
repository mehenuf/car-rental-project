import { describe, expect, it } from "vitest";
import { localizedVehicleText } from "./vehicle-text";

const base = { description: "A car", features: ["AC", "GPS"] };

describe("localizedVehicleText", () => {
  it("returns English when there is no translation", () => {
    expect(localizedVehicleText(base, null)).toEqual(base);
  });
  it("uses the translation where present", () => {
    expect(localizedVehicleText(base, { description: "Ein Auto", features: ["Klima"] })).toEqual({ description: "Ein Auto", features: ["Klima"] });
  });
  it("falls back per field when one is missing or malformed", () => {
    expect(localizedVehicleText(base, { description: "  ", features: ["Klima"] })).toEqual({ description: "A car", features: ["Klima"] });
    expect(localizedVehicleText(base, { description: "Ein Auto", features: [1, 2] })).toEqual({ description: "Ein Auto", features: base.features });
    expect(localizedVehicleText(base, { description: null, features: [] })).toEqual(base);
  });
});
