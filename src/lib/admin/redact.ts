const SECRET_KEY = /pass(word)?|secret|token|api[_-]?key|authorization|cookie|signature|otp|pin$/i;
const CARD_NUMBER = /^\d{13,19}$/;

/** A copy of a value safe to put in the audit log: secret-looking keys and card-like numbers are masked. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) || (typeof v === "string" && CARD_NUMBER.test(v)) ? "[redacted]" : redact(v)])
    );
  }
  return value;
}
