import { createHmac } from "node:crypto";

const MIN_LENGTH = 32;

/**
 * The key that signs price quotes. Uses QUOTE_SIGNING_SECRET when it is set and long enough; otherwise derives a
 * separate key from the server-only Supabase service key, so a missing setting cannot take booking down.
 * Set QUOTE_SIGNING_SECRET in production so the signing key can be rotated on its own.
 */
export function quoteSigningSecret(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.QUOTE_SIGNING_SECRET;
  if (explicit && explicit.length >= MIN_LENGTH) return explicit;
  const base = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Set QUOTE_SIGNING_SECRET (at least 32 characters).");
  return createHmac("sha256", base).update("bestcar:quote-signing:v1").digest("hex");
}
