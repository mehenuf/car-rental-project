import { describe, expect, it } from "vitest";
import { CONSENT_COOKIE, CURRENT_POLICY_VERSION, analyticsAllowed, decodeConsent, encodeConsent, needsBanner } from "./consent";

describe("consent cookie", () => {
  it("round-trips a choice with the policy version", () => {
    const value = encodeConsent({ analytics: true });
    expect(decodeConsent(value)).toEqual({ v: CURRENT_POLICY_VERSION, analytics: true });
    expect(CONSENT_COOKIE).toBe("bc_consent");
  });
  it("ignores garbage and missing values", () => {
    expect(decodeConsent(undefined)).toBeNull();
    expect(decodeConsent("nonsense")).toBeNull();
    expect(decodeConsent(encodeURIComponent('{"v":1}'))).toBeNull();
  });
});

describe("needsBanner", () => {
  it("shows when nothing is saved", () => {
    expect(needsBanner(undefined)).toBe(true);
  });
  it("shows again when the policy version changed", () => {
    expect(needsBanner(encodeURIComponent(JSON.stringify({ v: "2020-01", analytics: true })))).toBe(true);
  });
  it("hides once the current version has an answer", () => {
    expect(needsBanner(encodeConsent({ analytics: false }))).toBe(false);
  });
});

describe("analyticsAllowed", () => {
  it("is off until the visitor says yes, and off after a decline", () => {
    expect(analyticsAllowed(undefined)).toBe(false);
    expect(analyticsAllowed(encodeConsent({ analytics: false }))).toBe(false);
    expect(analyticsAllowed(encodeConsent({ analytics: true }))).toBe(true);
  });
  it("is off again when the policy version changed", () => {
    expect(analyticsAllowed(encodeURIComponent(JSON.stringify({ v: "2020-01", analytics: true })))).toBe(false);
  });
});
