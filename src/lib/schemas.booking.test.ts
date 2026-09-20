import { describe, expect, it } from "vitest";
import {
  ConfirmPaymentSchema,
  CreateBookingSchema,
  QuoteRequestSchema,
  StartPaymentSchema,
  UpdateVehicleSchema,
  VehiclesQuerySchema,
} from "@/lib/schemas";

const base = {
  vehicle_id: "11111111-1111-4111-8111-111111111111",
  customer_name: "Jane",
  email: "jane@example.com",
  pickup_at: "2030-03-01T10:00:00Z",
  dropoff_at: "2030-03-03T10:00:00Z",
};

describe("CreateBookingSchema", () => {
  it("accepts branch ids", () => {
    const r = CreateBookingSchema.safeParse({ ...base, pickup_branch_id: "1", dropoff_branch_id: 2 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pickup_branch_id).toBe(1);
      expect(r.data.dropoff_branch_id).toBe(2);
    }
  });

  it("rejects drop-off before pick-up", () => {
    const r = CreateBookingSchema.safeParse({ ...base, dropoff_at: "2030-02-01T10:00:00Z" });
    expect(r.success).toBe(false);
  });
});

describe("VehiclesQuerySchema availability params", () => {
  it("parses location ids and dates", () => {
    const r = VehiclesQuerySchema.safeParse({
      pickupLocationId: "1",
      dropoffLocationId: "2",
      pickupDate: "2030-03-01",
      dropoffDate: "2030-03-03",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a drop-off date on or before the pick-up date", () => {
    const r = VehiclesQuerySchema.safeParse({ pickupDate: "2030-03-03", dropoffDate: "2030-03-03" });
    expect(r.success).toBe(false);
  });
});

describe("UpdateVehicleSchema", () => {
  it("does not let an update set stock (fleet size comes from units)", () => {
    const r = UpdateVehicleSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", stock: 5 });
    expect(r.success).toBe(true);
    if (r.success) expect("stock" in r.data).toBe(false);
  });
});

describe("QuoteRequestSchema", () => {
  it("accepts a minimal request and defaults extras to an empty list", () => {
    const r = QuoteRequestSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.extras).toEqual([]);
  });

  it("accepts extras, a promo code, branches and a driver age", () => {
    const r = QuoteRequestSchema.safeParse({
      ...base,
      pickup_branch_id: "1",
      dropoff_branch_id: 2,
      extras: [{ code: "seat", quantity: "2" }],
      promo_code: " SAVE10 ",
      driver_age: "27",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.extras).toEqual([{ code: "seat", quantity: 2 }]);
      expect(r.data.promo_code).toBe("SAVE10");
      expect(r.data.driver_age).toBe(27);
    }
  });

  it("rejects a drop-off before pick-up, bad extras and an absurd driver age", () => {
    expect(QuoteRequestSchema.safeParse({ ...base, dropoff_at: "2030-02-01T10:00:00Z" }).success).toBe(false);
    expect(QuoteRequestSchema.safeParse({ ...base, extras: [{ code: "", quantity: 1 }] }).success).toBe(false);
    expect(QuoteRequestSchema.safeParse({ ...base, extras: [{ code: "seat", quantity: 0 }] }).success).toBe(false);
    expect(QuoteRequestSchema.safeParse({ ...base, driver_age: 5 }).success).toBe(false);
  });
});

describe("CreateBookingSchema pricing fields", () => {
  it("accepts extras, promo code, driver age and a quote token", () => {
    const r = CreateBookingSchema.safeParse({
      ...base,
      extras: [{ code: "gps", quantity: 1 }],
      promo_code: "SAVE10",
      driver_age: 30,
      quote_token: "abc.def",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.quote_token).toBe("abc.def");
      expect(r.data.extras).toEqual([{ code: "gps", quantity: 1 }]);
    }
  });

  it("still works without any pricing fields", () => {
    const r = CreateBookingSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.extras).toEqual([]);
  });
});

describe("payment request schemas", () => {
  it("accepts a checkout request and rejects unknown methods or short attempt ids", () => {
    const ok = StartPaymentSchema.safeParse({ reference: "BC-ABC123", method: "mpesa", attempt: "attempt-0001", test_input: "decline" });
    expect(ok.success).toBe(true);
    expect(StartPaymentSchema.safeParse({ reference: "BC-ABC123", method: "cash", attempt: "attempt-0001" }).success).toBe(false);
    expect(StartPaymentSchema.safeParse({ reference: "BC-ABC123", method: "card", attempt: "x" }).success).toBe(false);
  });

  it("accepts an optional confirmation code", () => {
    expect(ConfirmPaymentSchema.safeParse({}).success).toBe(true);
    expect(ConfirmPaymentSchema.safeParse({ code: "000000" }).success).toBe(true);
    expect(ConfirmPaymentSchema.safeParse({ code: "x".repeat(40) }).success).toBe(false);
  });
});
