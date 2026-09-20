import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_OPTIONS,
  assertTransition,
  canTransition,
  nextStatuses,
} from "@/lib/booking-state";
import { ConflictError } from "@/lib/errors";

// Mirror of the matrix in tests/sql/03_booking_lifecycle.test.sql.
const LEGAL = new Set([
  "pending>confirmed",
  "pending>cancelled",
  "confirmed>active",
  "confirmed>cancelled",
  "confirmed>no_show",
  "active>completed",
]);

describe("booking state machine", () => {
  it("allows exactly the legal transitions", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(LEGAL.has(`${from}>${to}`));
      }
    }
  });

  it("lists next statuses and has none for terminal states", () => {
    expect(nextStatuses("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextStatuses("completed")).toEqual([]);
    expect(nextStatuses("cancelled")).toEqual([]);
    expect(nextStatuses("no_show")).toEqual([]);
  });

  it("assertTransition throws a 409 for an illegal move", () => {
    expect(() => assertTransition("completed", "pending")).toThrow(ConflictError);
    expect(() => assertTransition("pending", "confirmed")).not.toThrow();
  });

  it("exposes a labelled option per status", () => {
    expect(BOOKING_STATUS_OPTIONS).toHaveLength(6);
    expect(BOOKING_STATUS_OPTIONS.find((o) => o.value === "no_show")?.label).toBe("No-show");
  });
});
