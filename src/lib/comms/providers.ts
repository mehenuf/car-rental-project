import { randomUUID } from "node:crypto";
import type { EmailProvider, PushProvider, SendResult, SmsProvider } from "./types";

type FetchFn = typeof fetch;

/** HTTP statuses where trying again later can help: rate limits and server errors. */
function isTemporary(status: number): boolean {
  return status === 429 || status >= 500;
}

export function createResendProvider(opts: { apiKey: string; from: string; fetchFn?: FetchFn }): EmailProvider {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    name: "resend",
    async send({ to, subject, html, text }): Promise<SendResult> {
      try {
        const res = await fetchFn("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: opts.from, to: [to], subject, html, text }),
        });
        const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
        if (res.ok && body.id) return { ok: true, providerRef: body.id };
        return { ok: false, error: body.message ?? `Resend ${res.status}`, permanent: !isTemporary(res.status) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err), permanent: false };
      }
    },
  };
}

export function createTwilioProvider(opts: {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
  fetchFn?: FetchFn;
}): SmsProvider {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    name: "twilio",
    async send({ to, body }): Promise<SendResult> {
      try {
        const res = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${opts.accountSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, MessagingServiceSid: opts.messagingServiceSid, Body: body }).toString(),
        });
        const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
        if (res.ok && data.sid) return { ok: true, providerRef: data.sid };
        return { ok: false, error: data.message ?? `Twilio ${res.status}`, permanent: !isTemporary(res.status) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err), permanent: false };
      }
    },
  };
}

/**
 * The default when no keys are set: writes what would have been sent to the console and reports
 * success, so the whole booking flow and the notification history work in a demo.
 */
export function logProviders(log: (line: string) => void = (line) => console.info(line)): {
  email: EmailProvider;
  sms: SmsProvider;
  push: PushProvider;
} {
  const ok = (): SendResult => ({ ok: true, providerRef: `log:${randomUUID()}` });
  return {
    email: { name: "log", send: async (i) => (log(`[email] to=${i.to} subject=${i.subject}`), ok()) },
    sms: { name: "log", send: async (i) => (log(`[sms] to=${i.to} body=${i.body}`), ok()) },
    push: { name: "log", send: async (i) => (log(`[push] ${i.title}: ${i.body}`), ok()) },
  };
}
