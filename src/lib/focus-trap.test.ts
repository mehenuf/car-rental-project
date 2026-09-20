import { describe, expect, it } from "vitest";
import { nextTrapTarget } from "./focus-trap";

describe("nextTrapTarget", () => {
  const items = ["a", "b", "c"];
  it("wraps from the last control to the first on Tab", () => {
    expect(nextTrapTarget(items, "c", false)).toBe("a");
    expect(nextTrapTarget(items, "b", false)).toBeNull();
  });
  it("wraps from the first control (or the dialog itself) to the last on Shift+Tab", () => {
    expect(nextTrapTarget(items, "a", true)).toBe("c");
    expect(nextTrapTarget(items, "root", true, "root")).toBe("c");
    expect(nextTrapTarget(items, "b", true)).toBeNull();
  });
  it("does nothing when there is nothing to focus", () => {
    expect(nextTrapTarget([], null, false)).toBeNull();
  });
});
