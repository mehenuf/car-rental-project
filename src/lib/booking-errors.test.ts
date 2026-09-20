import { describe, expect, it } from "vitest";
import { toBookingApiError } from "@/lib/booking-errors";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";

describe("toBookingApiError", () => {
  it("maps BC002 to a 409 about availability", () => {
    const err = toBookingApiError({ code: "BC002", message: "x" }, "createBooking");
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toMatch(/no longer available/i);
  });

  it("maps BC001 to a 409", () => {
    expect(toBookingApiError({ code: "BC001", message: "x" }, "updateBookingStatus")).toBeInstanceOf(ConflictError);
  });

  it("maps BC003 and BC004 to 400s", () => {
    for (const code of ["BC003", "BC004"]) {
      const err = toBookingApiError({ code, message: "x" }, "createBooking");
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
    }
  });

  it("maps P0002 to a 404", () => {
    expect(toBookingApiError({ code: "P0002", message: "x" }, "updateBookingStatus")).toBeInstanceOf(NotFoundError);
  });

  it("wraps unknown errors with context so they become a 500", () => {
    const err = toBookingApiError({ code: "XX000", message: "boom" }, "createBooking");
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err.message).toBe("createBooking: boom");
  });
});
