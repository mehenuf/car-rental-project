import { describe, expect, it } from "vitest";
import { DriverDocumentUploadSchema, DriverProfileInputSchema, LicenceReviewSchema, signupMode } from "./schemas";

const now = new Date("2026-09-20T12:00:00Z");
const valid = { date_of_birth: "1990-06-15", licence_country: "gb", licence_number_last4: "ab12", licence_expiry: "2030-01-31" };

describe("DriverProfileInputSchema", () => {
  const parse = (input: unknown) => DriverProfileInputSchema(now).safeParse(input);

  it("accepts a normal profile and normalises the country and last four", () => {
    const result = parse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.licence_country).toBe("GB");
      expect(result.data.licence_number_last4).toBe("AB12");
    }
  });
  it("rejects an underage or impossible date of birth", () => {
    expect(parse({ ...valid, date_of_birth: "2015-01-01" }).success).toBe(false);
    expect(parse({ ...valid, date_of_birth: "2009-06-15" }).success).toBe(false);
    expect(parse({ ...valid, date_of_birth: "2008-09-20" }).success).toBe(true);
    expect(parse({ ...valid, date_of_birth: "1800-01-01" }).success).toBe(false);
    expect(parse({ ...valid, date_of_birth: "1990-13-45" }).success).toBe(false);
  });
  it("rejects a licence that has already expired", () => {
    expect(parse({ ...valid, licence_expiry: "2026-09-19" }).success).toBe(false);
    expect(parse({ ...valid, licence_expiry: "2026-09-20" }).success).toBe(true);
  });
  it("rejects a bad country or last four", () => {
    expect(parse({ ...valid, licence_country: "GBR" }).success).toBe(false);
    expect(parse({ ...valid, licence_number_last4: "AB-1" }).success).toBe(false);
  });
});

describe("DriverDocumentUploadSchema", () => {
  it("accepts an image or pdf within 5 MB", () => {
    expect(DriverDocumentUploadSchema.safeParse({ kind: "licence_front", file_name: "a.jpg", mime_type: "image/jpeg", size_bytes: 1000 }).success).toBe(true);
    expect(DriverDocumentUploadSchema.safeParse({ kind: "licence_back", file_name: "a.pdf", mime_type: "application/pdf", size_bytes: 1000 }).success).toBe(true);
  });
  it("rejects a selfie pdf, oversize and other types", () => {
    expect(DriverDocumentUploadSchema.safeParse({ kind: "selfie", file_name: "a.pdf", mime_type: "application/pdf", size_bytes: 10 }).success).toBe(false);
    expect(DriverDocumentUploadSchema.safeParse({ kind: "licence_front", file_name: "a.jpg", mime_type: "image/jpeg", size_bytes: 5242881 }).success).toBe(false);
    expect(DriverDocumentUploadSchema.safeParse({ kind: "licence_front", file_name: "a.exe", mime_type: "application/x-msdownload", size_bytes: 10 }).success).toBe(false);
  });
});

describe("LicenceReviewSchema", () => {
  it("needs a note to reject", () => {
    expect(LicenceReviewSchema.safeParse({ decision: "approve" }).success).toBe(true);
    expect(LicenceReviewSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(LicenceReviewSchema.safeParse({ decision: "reject", note: "Photo is blurry" }).success).toBe(true);
  });
});

describe("signupMode", () => {
  it("verifies email by default", () => {
    expect(signupMode({})).toBe("verify");
    expect(signupMode({ AUTH_REQUIRE_EMAIL_VERIFICATION: "true" })).toBe("verify");
  });
  it("can be switched off for demos without an email provider", () => {
    expect(signupMode({ AUTH_REQUIRE_EMAIL_VERIFICATION: "false" })).toBe("preconfirm");
  });
});
