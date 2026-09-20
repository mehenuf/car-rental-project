import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ApiError, ConflictError } from "@/lib/errors";
import type { QuoteInput } from "@/lib/pricing/types";

const TTL_SECONDS = 15 * 60;
const MIN_SECRET_LENGTH = 32;

export interface QuoteTokenPayload {
  inputHash: string;
  totalMinor: number;
  currency: string;
}

export interface VerifiedQuoteToken extends QuoteTokenPayload {
  expiresAt: Date;
}

/** Stable hash of everything that affects the price, so a token cannot be reused for a different trip. */
export function hashQuoteInput(input: QuoteInput): string {
  const canonical = {
    vehicleId: input.vehicleId,
    pickupAt: input.pickupAt.toISOString(),
    dropoffAt: input.dropoffAt.toISOString(),
    pickupBranchId: input.pickupBranchId,
    dropoffBranchId: input.dropoffBranchId,
    extras: [...input.extras]
      .map((e) => ({ code: e.code, quantity: e.quantity }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    promoCode: input.promoCode ? input.promoCode.trim().toLowerCase() : null,
    driverAge: input.driverAge,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function sign(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

/** `<base64url payload>.<base64url HMAC-SHA256>`, valid for 15 minutes. */
export function signQuoteToken(
  payload: QuoteTokenPayload,
  secret: string,
  now: Date = new Date()
): { token: string; expiresAt: Date } {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`QUOTE_SIGNING_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
  const expiresAt = new Date(Math.floor(now.getTime() / 1000) * 1000 + TTL_SECONDS * 1000);
  const body = Buffer.from(
    JSON.stringify({ h: payload.inputHash, t: payload.totalMinor, c: payload.currency, e: expiresAt.getTime() / 1000 })
  ).toString("base64url");
  const signature = sign(body, secret).toString("base64url");
  return { token: `${body}.${signature}`, expiresAt };
}

/** Throws a 400 for a token that is malformed or forged, and a 409 for one that has expired. */
export function verifyQuoteToken(token: string, secret: string, now: Date = new Date()): VerifiedQuoteToken {
  const invalid = () => new ApiError(400, "Invalid quote token.");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`QUOTE_SIGNING_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalid();
  const [body, signature] = parts as [string, string];

  const expected = sign(body, secret);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();

  let parsed: { h?: unknown; t?: unknown; c?: unknown; e?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (
    typeof parsed.h !== "string" ||
    typeof parsed.t !== "number" ||
    typeof parsed.c !== "string" ||
    typeof parsed.e !== "number"
  ) {
    throw invalid();
  }

  const expiresAt = new Date(parsed.e * 1000);
  if (now.getTime() > expiresAt.getTime()) {
    throw new ConflictError("This quote has expired. Please request a new price.");
  }
  return { inputHash: parsed.h, totalMinor: parsed.t, currency: parsed.c, expiresAt };
}
