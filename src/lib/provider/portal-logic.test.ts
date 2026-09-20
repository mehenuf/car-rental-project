import { describe, expect, it } from "vitest";
import { buildUnitRow, monthDays, nextDay, startOfDayInZone } from "@/lib/provider/calendar";
import { summarizeBookings, utilisationPercent } from "@/lib/provider/overview";

describe("startOfDayInZone", () => {
  it("is midnight UTC for UTC", () => {
    expect(startOfDayInZone("2030-03-10", "UTC").toISOString()).toBe("2030-03-10T00:00:00.000Z");
  });

  it("converts a local midnight to the right instant, including half-hour offsets", () => {
    expect(startOfDayInZone("2030-01-15", "America/New_York").toISOString()).toBe("2030-01-15T05:00:00.000Z");
    expect(startOfDayInZone("2030-01-15", "Asia/Kolkata").toISOString()).toBe("2030-01-14T18:30:00.000Z");
    expect(startOfDayInZone("2030-01-15", "Pacific/Auckland").toISOString()).toBe("2030-01-14T11:00:00.000Z");
  });

  it("uses the offset in force on that date across daylight saving time", () => {
    expect(startOfDayInZone("2030-07-15", "America/New_York").toISOString()).toBe("2030-07-15T04:00:00.000Z");
    // The day the clocks go forward in New York (2030-03-10): midnight is still EST.
    expect(startOfDayInZone("2030-03-10", "America/New_York").toISOString()).toBe("2030-03-10T05:00:00.000Z");
    expect(startOfDayInZone("2030-03-11", "America/New_York").toISOString()).toBe("2030-03-11T04:00:00.000Z");
  });
});

describe("date helpers", () => {
  it("lists the days of a month and steps to the next day", () => {
    expect(monthDays("2030-02")).toHaveLength(28);
    expect(monthDays("2032-02")).toHaveLength(29);
    expect(monthDays("2030-03")[0]).toBe("2030-03-01");
    expect(monthDays("2030-03")[30]).toBe("2030-03-31");
    expect(nextDay("2030-03-31")).toBe("2030-04-01");
    expect(nextDay("2030-12-31")).toBe("2031-01-01");
  });
});

describe("buildUnitRow", () => {
  const days = monthDays("2030-03");
  const at = (s: string) => new Date(s);

  it("marks days covered by a booking, with the buffer, and leaves the rest free", () => {
    const row = buildUnitRow(days, "UTC", [{ reason: "booking", start: at("2030-03-05T10:00:00Z"), end: at("2030-03-07T11:00:00Z") }], null);
    expect(row[3]).toBe("free");
    expect(row.slice(4, 7)).toEqual(["booking", "booking", "booking"]);
    expect(row[7]).toBe("free");
  });

  it("prefers a booking over maintenance over an owner block on the same day", () => {
    const row = buildUnitRow(
      days,
      "UTC",
      [
        { reason: "owner_block", start: at("2030-03-10T00:00:00Z"), end: at("2030-03-11T00:00:00Z") },
        { reason: "maintenance", start: at("2030-03-10T00:00:00Z"), end: at("2030-03-11T00:00:00Z") },
        { reason: "booking", start: at("2030-03-12T09:00:00Z"), end: at("2030-03-12T12:00:00Z") },
        { reason: "owner_block", start: at("2030-03-12T00:00:00Z"), end: at("2030-03-13T00:00:00Z") },
      ],
      null
    );
    expect(row[9]).toBe("maintenance");
    expect(row[11]).toBe("booking");
  });

  it("marks days outside an owner's availability windows as unavailable", () => {
    const row = buildUnitRow(days, "UTC", [], [{ start: at("2030-03-02T00:00:00Z"), end: at("2030-03-05T00:00:00Z") }]);
    expect(row[0]).toBe("unavailable");
    expect(row.slice(1, 4)).toEqual(["free", "free", "free"]);
    expect(row[4]).toBe("unavailable");
  });

  it("treats a unit without windows as open every day", () => {
    expect(buildUnitRow(days, "UTC", [], null).every((c) => c === "free")).toBe(true);
  });
});

describe("summarizeBookings", () => {
  const now = new Date("2030-03-15T12:00:00Z");
  const b = (over: Partial<Parameters<typeof summarizeBookings>[0][number]>) => ({
    status: "confirmed",
    payment_status: "paid",
    created_at: "2030-03-10T00:00:00Z",
    pickup_at: "2030-03-20T10:00:00Z",
    dropoff_at: "2030-03-22T10:00:00Z",
    providerPayoutMinor: 8000,
    ...over,
  });

  it("counts this month's bookings and earnings, ignoring cancelled and unpaid ones for earnings", () => {
    const s = summarizeBookings(
      [
        b({}),
        b({ providerPayoutMinor: 5000 }),
        b({ status: "cancelled", payment_status: "refunded" }),
        b({ payment_status: "unpaid", status: "pending", providerPayoutMinor: 9000 }),
        b({ created_at: "2030-02-10T00:00:00Z" }),
      ],
      now,
      "UTC"
    );
    expect(s.bookingsThisMonth).toBe(3); // cancelled excluded; the February booking is outside the month
    expect(s.earningsThisMonthMinor).toBe(13000);
  });

  it("finds today's pick-ups and returns in the branch time zone", () => {
    const s = summarizeBookings(
      [
        b({ pickup_at: "2030-03-15T09:00:00Z", dropoff_at: "2030-03-16T09:00:00Z" }),
        b({ pickup_at: "2030-03-14T09:00:00Z", dropoff_at: "2030-03-15T18:00:00Z", status: "active" }),
        b({ pickup_at: "2030-03-15T09:00:00Z", status: "cancelled" }),
      ],
      now,
      "UTC"
    );
    expect(s.pickupsToday).toBe(1);
    expect(s.returnsToday).toBe(1);
  });
});

describe("utilisationPercent", () => {
  it("is occupied time over available unit time, capped at 100", () => {
    const day = 86_400_000;
    expect(utilisationPercent(15 * day, 1, 30 * day)).toBe(50);
    expect(utilisationPercent(90 * day, 2, 30 * day)).toBe(100);
    expect(utilisationPercent(0, 3, 30 * day)).toBe(0);
    expect(utilisationPercent(10, 0, 30 * day)).toBe(0);
  });
});
