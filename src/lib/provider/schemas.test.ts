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
