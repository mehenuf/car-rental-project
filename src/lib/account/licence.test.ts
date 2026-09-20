import { describe, expect, it } from "vitest";
import { canTransition, isLicenceValidOn } from "./licence";

describe("licence status transitions", () => {
  it("lets a customer submit or resubmit", () => {
    expect(canTransition("unverified", "pending", "customer")).toBe(true);
    expect(canTransition("rejected", "pending", "customer")).toBe(true);
    expect(canTransition("expired", "pending", "customer")).toBe(true);
  });
  it("only a reviewer verifies or rejects, and only from pending", () => {
    expect(canTransition("pending", "verified", "reviewer")).toBe(true);
    expect(canTransition("pending", "rejected", "reviewer")).toBe(true);
    expect(canTransition("pending", "verified", "customer")).toBe(false);
    expect(canTransition("unverified", "verified", "reviewer")).toBe(false);
  });
  it("the system expires verified licences and nothing else", () => {
    expect(canTransition("verified", "expired", "system")).toBe(true);
    expect(canTransition("pending", "expired", "system")).toBe(false);
    expect(canTransition("verified", "expired", "customer")).toBe(false);
  });
  it("a customer cannot resubmit while a review is pending", () => {
    expect(canTransition("pending", "pending", "customer")).toBe(false);
  });
});

describe("isLicenceValidOn", () => {
  const verified = { status: "verified" as const, licenceExpiry: "2027-01-31" };
  it("requires verification", () => {
    expect(
      isLicenceValidOn({ status: "pending", licenceExpiry: "2030-01-01" }, new Date("2026-09-01"), new Date("2026-09-05"))
    ).toBe(false);
  });
  it("requires the licence to outlast the whole rental", () => {
    expect(isLicenceValidOn(verified, new Date("2026-09-01"), new Date("2026-09-05"))).toBe(true);
    expect(isLicenceValidOn(verified, new Date("2027-01-30"), new Date("2027-02-02"))).toBe(false);
    expect(isLicenceValidOn(verified, new Date("2027-01-29"), new Date("2027-01-31"))).toBe(true);
  });
  it("a missing expiry is not valid", () => {
    expect(
      isLicenceValidOn({ status: "verified", licenceExpiry: null }, new Date("2026-09-01"), new Date("2026-09-05"))
    ).toBe(false);
  });
});
