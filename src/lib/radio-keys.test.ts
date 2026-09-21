import { describe, expect, it } from "vitest";
import { nextRadioValue } from "./radio-keys";

const values = ["renter", "individual", "company"];

describe("nextRadioValue", () => {
  it("moves with the arrow keys and wraps round", () => {
    expect(nextRadioValue("ArrowDown", values, "renter")).toBe("individual");
    expect(nextRadioValue("ArrowRight", values, "company")).toBe("renter");
    expect(nextRadioValue("ArrowUp", values, "renter")).toBe("company");
    expect(nextRadioValue("ArrowLeft", values, "company")).toBe("individual");
  });

  it("swaps left and right in a right-to-left page", () => {
    expect(nextRadioValue("ArrowLeft", values, "renter", true)).toBe("individual");
    expect(nextRadioValue("ArrowRight", values, "renter", true)).toBe("company");
  });

  it("goes to the ends with Home and End and ignores other keys", () => {
    expect(nextRadioValue("Home", values, "company")).toBe("renter");
    expect(nextRadioValue("End", values, "renter")).toBe("company");
    expect(nextRadioValue("a", values, "renter")).toBeNull();
    expect(nextRadioValue("ArrowDown", [], "x")).toBeNull();
  });
});
