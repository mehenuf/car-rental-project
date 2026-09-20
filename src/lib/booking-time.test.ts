import { describe, expect, it } from "vitest";
import { TIME_SLOTS, combineDateAndTime, firstAvailableSlot, formatSlot, parseTime } from "./booking-time";

describe("booking time", () => {
  it("offers half-hour slots from 06:00 to 20:00", () => {
    expect(TIME_SLOTS[0]).toBe("06:00");
    expect(TIME_SLOTS.at(-1)).toBe("20:00");
    expect(TIME_SLOTS).toHaveLength(29);
  });

  it("parses 24 hour and 12 hour times", () => {
    expect(parseTime("14:30")).toBe("14:30");
    expect(parseTime("2:30 PM")).toBe("14:30");
    expect(parseTime("12:00 AM")).toBe("00:00");
    expect(parseTime("12:00 pm")).toBe("12:00");
    expect(parseTime("10:00 AM")).toBe("10:00");
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("13:00 PM")).toBeNull();
    expect(parseTime("soon")).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });

  it("puts the time onto the chosen day without changing the day", () => {
    const d = combineDateAndTime(new Date(2027, 2, 10), "16:30");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2027, 2, 10, 16, 30]);
    expect(combineDateAndTime(new Date(2027, 2, 10), "junk").getHours()).toBe(10);
  });

  it("formats a slot for the language", () => {
    expect(formatSlot("14:30", "en-US")).toMatch(/2:30\s?PM/);
    expect(formatSlot("14:30", "de")).toContain("14:30");
  });

  it("skips slots that have already passed today", () => {
    const now = new Date(2027, 2, 10, 11, 10);
    expect(firstAvailableSlot(new Date(2027, 2, 10), now)).toBe("11:30");
    expect(firstAvailableSlot(new Date(2027, 2, 11), now)).toBe("06:00");
    expect(firstAvailableSlot(new Date(2027, 2, 10), new Date(2027, 2, 10, 23, 0))).toBe("20:00");
  });
});

import { defaultTrip } from "./booking-time";

describe("defaultTrip", () => {
  it("starts at the next free slot today and lasts a day", () => {
    const t = defaultTrip(new Date(2027, 2, 10, 9, 10));
    expect([t.pickupDate.getDate(), t.pickupTime, t.dropoffDate.getDate(), t.dropoffTime]).toEqual([10, "09:30", 11, "09:30"]);
  });
  it("moves to tomorrow morning when today has no free slot left", () => {
    const t = defaultTrip(new Date(2027, 2, 10, 21, 0));
    expect([t.pickupDate.getDate(), t.pickupTime, t.dropoffDate.getDate()]).toEqual([11, "06:00", 12]);
  });
});
