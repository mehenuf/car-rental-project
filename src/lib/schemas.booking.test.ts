import { describe, expect, it } from "vitest";
import { CreateBookingSchema, UpdateVehicleSchema, VehiclesQuerySchema } from "@/lib/schemas";

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
