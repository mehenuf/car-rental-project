import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

const BACKSLASH = String.fromCharCode(92);

describe("safeNext", () => {
  it("accepts a plain path with a query", () => {
    expect(safeNext("/account/trips/BC-1")).toBe("/account/trips/BC-1");
    expect(safeNext("/provider/apply?type=company")).toBe("/provider/apply?type=company");
  });

  it("takes the first value when the parameter is repeated", () => {
    expect(safeNext(["/account", "/other"])).toBe("/account");
  });

  it("rejects other sites and scheme tricks", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/" + BACKSLASH + "evil.example","javascript:alert(1)", "/javascript:alert(1)", "evil", ""]) {
      expect(safeNext(bad)).toBeNull();
    }
  });

  it("rejects control characters, very long values, admin and api paths", () => {
    expect(safeNext("/a\nb")).toBeNull();
    expect(safeNext("/" + "a".repeat(400))).toBeNull();
    expect(safeNext("/admin")).toBeNull();
    expect(safeNext("/api/auth/signup")).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
