import { describe, expect, it } from "vitest";
import { hashQuoteInput, signQuoteToken, verifyQuoteToken } from "@/lib/pricing/token";
import type { QuoteInput } from "@/lib/pricing/types";

const SECRET = "test-secret-at-least-32-characters-long";
const NOW = new Date("2030-03-01T10:00:00Z");

const input: QuoteInput = {
  vehicleId: "v1",
  pickupAt: new Date("2030-03-05T10:00:00Z"),
  dropoffAt: new Date("2030-03-08T10:00:00Z"),
  pickupBranchId: 1,
  dropoffBranchId: 2,
  extras: [
    { code: "seat", quantity: 1 },
    { code: "gps", quantity: 1 },
  ],
  promoCode: "Save10",
  driverAge: 30,
};

describe("hashQuoteInput", () => {
  it("is stable regardless of extras order and promo case", () => {
    const a = hashQuoteInput(input);
    const b = hashQuoteInput({ ...input, extras: [...input.extras].reverse(), promoCode: "SAVE10" });
    expect(a).toBe(b);
  });

  it("changes when any priced field changes", () => {
    const base = hashQuoteInput(input);
    expect(hashQuoteInput({ ...input, vehicleId: "v2" })).not.toBe(base);
    expect(hashQuoteInput({ ...input, dropoffBranchId: 1 })).not.toBe(base);
    expect(hashQuoteInput({ ...input, dropoffAt: new Date("2030-03-09T10:00:00Z") })).not.toBe(base);
    expect(hashQuoteInput({ ...input, extras: [{ code: "seat", quantity: 2 }] })).not.toBe(base);
    expect(hashQuoteInput({ ...input, promoCode: null })).not.toBe(base);
    expect(hashQuoteInput({ ...input, driverAge: 22 })).not.toBe(base);
  });
});

describe("quote tokens", () => {
  const payload = { inputHash: hashQuoteInput(input), totalMinor: 15750, currency: "USD" };

  it("round-trips a valid token", () => {
    const { token, expiresAt } = signQuoteToken(payload, SECRET, NOW);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + 15 * 60 * 1000);
    expect(verifyQuoteToken(token, SECRET, new Date(NOW.getTime() + 60_000))).toEqual({
      ...payload,
      expiresAt,
    });
  });

  it("rejects an expired token", () => {
    const { token } = signQuoteToken(payload, SECRET, NOW);
    expect(() => verifyQuoteToken(token, SECRET, new Date(NOW.getTime() + 16 * 60 * 1000))).toThrowError(/expired/i);
  });

  it("rejects a token signed with a different secret", () => {
    const { token } = signQuoteToken(payload, "another-secret-that-is-long-enough-123", NOW);
    expect(() => verifyQuoteToken(token, SECRET, NOW)).toThrowError(/invalid/i);
  });

  it("rejects a tampered payload or signature", () => {
    const { token } = signQuoteToken(payload, SECRET, NOW);
    const [body, sig] = token.split(".") as [string, string];
    const forged = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    forged.t = 100; // cheaper total
    const forgedBody = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(() => verifyQuoteToken(`${forgedBody}.${sig}`, SECRET, NOW)).toThrowError(/invalid/i);
    expect(() => verifyQuoteToken(`${body}.${sig.slice(0, -2)}AA`, SECRET, NOW)).toThrowError(/invalid/i);
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "abc", "a.b.c", ".", "###.###"]) {
      expect(() => verifyQuoteToken(bad, SECRET, NOW)).toThrowError(/invalid/i);
    }
  });

  it("refuses to sign with a short secret", () => {
    expect(() => signQuoteToken(payload, "short", NOW)).toThrowError(/secret/i);
  });
});
