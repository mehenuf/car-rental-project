import { describe, expect, it } from "vitest";
import { preferenceCookie } from "@/lib/client-cookie";

describe("preferenceCookie", () => {
  it("is site-wide, lasts a year and is lax", () => {
    expect(preferenceCookie("bc_lang", "de", false)).toBe("bc_lang=de; path=/; max-age=31536000; samesite=lax");
  });

  it("adds Secure on https only", () => {
    expect(preferenceCookie("bc_lang", "de", true)).toBe("bc_lang=de; path=/; max-age=31536000; samesite=lax; secure");
    expect(preferenceCookie("bc_lang", "de", false)).not.toContain("secure");
  });
});
