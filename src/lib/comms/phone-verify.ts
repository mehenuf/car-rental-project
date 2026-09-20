type FetchFn = typeof fetch;

export interface PhoneVerifier {
  start(phone: string): Promise<{ ok: boolean; error?: string }>;
  check(phone: string, code: string): Promise<boolean>;
}

/** Demo mode with no Twilio Verify service: the code is always 000000 and nothing is sent. */
export const demoVerifier: PhoneVerifier = {
  start: async () => ({ ok: true }),
  check: async (_phone, code) => code === "000000",
};

/** Twilio Verify: sends the code by SMS and checks it, so we never store or compare codes ourselves. */
export function createTwilioVerifier(opts: {
  accountSid: string;
  authToken: string;
  serviceSid: string;
  fetchFn?: FetchFn;
}): PhoneVerifier {
  const fetchFn = opts.fetchFn ?? fetch;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const base = `https://verify.twilio.com/v2/Services/${opts.serviceSid}`;
  return {
    async start(phone) {
      try {
        const res = await fetchFn(`${base}/Verifications`, {
          method: "POST",
          headers,
          body: new URLSearchParams({ To: phone, Channel: "sms" }).toString(),
        });
        if (res.ok) return { ok: true };
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        return { ok: false, error: body.message ?? `Twilio Verify ${res.status}` };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async check(phone, code) {
      try {
        const res = await fetchFn(`${base}/VerificationCheck`, {
          method: "POST",
          headers,
          body: new URLSearchParams({ To: phone, Code: code }).toString(),
        });
        const body = (await res.json().catch(() => ({}))) as { status?: string };
        return res.ok && body.status === "approved";
      } catch {
        return false;
      }
    },
  };
}

export function verifierFromEnv(env: Record<string, string | undefined> = process.env): PhoneVerifier {
  return env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID
    ? createTwilioVerifier({ accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN, serviceSid: env.TWILIO_VERIFY_SERVICE_SID })
    : demoVerifier;
}
