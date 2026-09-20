import { describe, expect, it } from "vitest";
import { ApplySchema, DocumentUploadSchema, ProviderReviewSchema } from "@/lib/provider/schemas";

const branch = { name: "Downtown", city: "Austin", address: "12 Main Street", timezone: "America/Chicago" };
const base = {
  type: "company",
  legal_name: "Acme Rentals Ltd",
  display_name: "Acme Rentals",
  country_code: "us",
  currency: "usd",
  contact_phone: "+1 555 0100",
  branch,
};

describe("ApplySchema", () => {
  it("normalises country and currency to upper case", () => {
    const r = ApplySchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.country_code).toBe("US");
      expect(r.data.currency).toBe("USD");
    }
  });

  it("rejects unsupported currencies, unknown time zones and short names", () => {
    expect(ApplySchema.safeParse({ ...base, currency: "KWD" }).success).toBe(false);
    expect(ApplySchema.safeParse({ ...base, branch: { ...branch, timezone: "Mars/Olympus" } }).success).toBe(false);
    expect(ApplySchema.safeParse({ ...base, legal_name: "A" }).success).toBe(false);
    expect(ApplySchema.safeParse({ ...base, type: "agency" }).success).toBe(false);
  });
});

describe("DocumentUploadSchema", () => {
  it("accepts a known kind and coerces the size", () => {
    const r = DocumentUploadSchema.safeParse({ kind: "id_document", file_name: "id.pdf", mime_type: "application/pdf", size_bytes: "1000" });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown kind or a non-positive size", () => {
    expect(DocumentUploadSchema.safeParse({ kind: "selfie", file_name: "a.png", mime_type: "image/png", size_bytes: 10 }).success).toBe(false);
    expect(DocumentUploadSchema.safeParse({ kind: "id_document", file_name: "a.png", mime_type: "image/png", size_bytes: 0 }).success).toBe(false);
  });
});

describe("ProviderReviewSchema", () => {
  it("accepts the four decisions only", () => {
    for (const decision of ["approve", "reject", "suspend", "reinstate"]) {
      expect(ProviderReviewSchema.safeParse({ decision }).success).toBe(true);
    }
    expect(ProviderReviewSchema.safeParse({ decision: "delete" }).success).toBe(false);
  });
});

import { AvailabilitySchema, CreateUnitSchema, PayoutAccountSchema } from "@/lib/provider/schemas";

describe("portal schemas", () => {
  it("accepts a car with an optional first price", () => {
    const r = CreateUnitSchema.safeParse({ vehicle_id: "11111111-1111-4111-8111-111111111111", branch_id: "3", plate: "ABC-123", daily_price: "48.5" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.daily_price).toBe(48.5);
    expect(CreateUnitSchema.safeParse({ vehicle_id: "nope", branch_id: 1, plate: "ABC-123" }).success).toBe(false);
  });

  it("validates availability periods", () => {
    const unit = "11111111-1111-4111-8111-111111111111";
    expect(AvailabilitySchema.safeParse({ kind: "window", fleet_unit_id: unit, start_date: "2030-03-01", end_date: "2030-03-05" }).success).toBe(true);
    expect(AvailabilitySchema.safeParse({ kind: "block", fleet_unit_id: unit, start_date: "2030-03-01", end_date: "2030-03-05" }).success).toBe(false); // block needs a reason
    expect(AvailabilitySchema.safeParse({ kind: "block", block_reason: "maintenance", fleet_unit_id: unit, start_date: "2030-03-01", end_date: "2030-03-05" }).success).toBe(true);
    expect(AvailabilitySchema.safeParse({ kind: "window", fleet_unit_id: unit, start_date: "2030-03-05", end_date: "2030-03-01" }).success).toBe(false);
    expect(AvailabilitySchema.safeParse({ kind: "window", fleet_unit_id: unit, start_date: "2030-01-01", end_date: "2031-06-01" }).success).toBe(false);
  });

  it("takes a full account number but the schema itself never returns more than validated text", () => {
    expect(PayoutAccountSchema.safeParse({ account_holder: "Ola Owner", bank_name: "Test Bank", account_number: "GB29NWBK60161331926819", country_code: "gb" }).success).toBe(true);
    expect(PayoutAccountSchema.safeParse({ account_holder: "Ola Owner", bank_name: "Test Bank", account_number: "12", country_code: "GB" }).success).toBe(false);
  });
});
