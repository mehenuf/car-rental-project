const SENSITIVE = /(authorization|cookie|token|secret|password|email|phone|licen[cs]e|dob|date_of_birth|iban|account_number)/i;

/** Redacts values under sensitive-looking keys and email-shaped text; safe to send off-site. */
export function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (typeof value === "string") return value.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]");
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : scrub(v, depth + 1)]));
  }
  return value;
}

type Dsn = { url: string; key: string };

export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+/, "");
    if (!u.username || !project) return null;
    return { url: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username };
  } catch {
    return null;
  }
}

/** One structured log line; the platform's log drain collects it. */
export function logEvent(level: "info" | "warn" | "error", message: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...(scrub(fields) as object) });
  (level === "error" ? console.error : console.log)(line);
}

/** Logs the error and, when SENTRY_DSN is set, sends it to Sentry as an envelope. Never throws. */
export async function reportError(err: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  logEvent("error", scrub(message) as string, { digest, ...context });
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return;
  try {
    const eventId = crypto.randomUUID().replaceAll("-", "");
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "node",
      level: "error",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      exception: { values: [{ type: err instanceof Error ? err.name : "Error", value: scrub(message), stacktrace: undefined }] },
      extra: scrub({ digest, ...context }),
    };
    const body = [JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
    await fetch(dsn.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=bestcar-lite/1.0` },
      body,
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Monitoring must never break a request.
  }
}
