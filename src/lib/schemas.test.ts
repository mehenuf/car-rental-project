import { describe, expect, it } from "vitest";
import { BookingStatusSchema } from "@/lib/schemas";

describe("BookingStatusSchema", () => {
  it("accepts the six lifecycle statuses", () => {
    for (const s of ["pending", "confirmed", "active", "completed", "cancelled", "no_show"]) {
      expect(BookingStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejects the retired legacy status", () => {
    expect(BookingStatusSchema.safeParse("success").success).toBe(false);
  });
});
