import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const TOLERANCE_SECONDS = 300;

/**
 * Verifies a Resend webhook (signed with Svix): HMAC-SHA256 of "id.timestamp.body" with the base64
 * key after the "whsec_" prefix, sent as one or more space-separated "v1,<signature>" values.
 * Requests older than five minutes are refused so a captured request cannot be replayed.
 */
export function verifySvix(
  secret: string,
  headers: Record<string, string | undefined>,
  body: string,
  now: Date = new Date()
): boolean {
  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signatures = headers["svix-signature"];
  if (!id || !timestamp || !signatures) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent) || Math.abs(now.getTime() / 1000 - sent) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return signatures
    .split(" ")
    .map((s) => s.split(",")[1] ?? "")
    .some((candidate) => safeEqual(candidate, expected));
}

/** Verifies a Twilio webhook: base64 HMAC-SHA1 of the full URL followed by the sorted "keyvalue" pairs. */
export function verifyTwilio(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return safeEqual(signature, expected);
}
