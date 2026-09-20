import { describe, expect, it } from "vitest";
import { createResendProvider, createTwilioProvider, logProviders } from "./providers";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("resend provider", () => {
  const input = { to: "sam@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

  it("posts the message with a bearer key and returns the message id", async () => {
    const f = fakeFetch(200, { id: "re_123" });
    const result = await createResendProvider({ apiKey: "key", from: "BestCar <hello@bestcar.example>", fetchFn: f.fn }).send(input);
    expect(result).toEqual({ ok: true, providerRef: "re_123" });
    expect(f.calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((f.calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer key");
    expect(JSON.parse(f.calls[0]!.init.body as string)).toMatchObject({ from: "BestCar <hello@bestcar.example>", to: ["sam@example.com"], subject: "Hi" });
  });
  it("treats a rejected address as permanent and a server error or rate limit as temporary", async () => {
    const rejected = await createResendProvider({ apiKey: "k", from: "f", fetchFn: fakeFetch(422, { message: "invalid to" }).fn }).send(input);
    expect(rejected).toMatchObject({ ok: false, permanent: true });
    const limited = await createResendProvider({ apiKey: "k", from: "f", fetchFn: fakeFetch(429, { message: "slow down" }).fn }).send(input);
    expect(limited).toMatchObject({ ok: false, permanent: false });
    const down = await createResendProvider({ apiKey: "k", from: "f", fetchFn: fakeFetch(503, {}).fn }).send(input);
    expect(down).toMatchObject({ ok: false, permanent: false });
  });
  it("treats a network error as temporary", async () => {
    const boom = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await createResendProvider({ apiKey: "k", from: "f", fetchFn: boom }).send(input)).toMatchObject({ ok: false, permanent: false });
  });
});

describe("twilio provider", () => {
  it("posts a form with basic auth and the messaging service", async () => {
    const f = fakeFetch(201, { sid: "SM1" });
    const result = await createTwilioProvider({ accountSid: "AC1", authToken: "tok", messagingServiceSid: "MG1", fetchFn: f.fn }).send({ to: "+15550001111", body: "Hello" });
    expect(result).toEqual({ ok: true, providerRef: "SM1" });
    expect(f.calls[0]!.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect((f.calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("AC1:tok").toString("base64")}`);
    const form = new URLSearchParams(f.calls[0]!.init.body as string);
    expect(form.get("To")).toBe("+15550001111");
    expect(form.get("MessagingServiceSid")).toBe("MG1");
    expect(form.get("Body")).toBe("Hello");
  });
  it("treats an opted-out or invalid number as permanent", async () => {
    const optedOut = await createTwilioProvider({ accountSid: "a", authToken: "t", messagingServiceSid: "m", fetchFn: fakeFetch(400, { code: 21610, message: "unsubscribed" }).fn }).send({ to: "+1", body: "x" });
    expect(optedOut).toMatchObject({ ok: false, permanent: true });
    const server = await createTwilioProvider({ accountSid: "a", authToken: "t", messagingServiceSid: "m", fetchFn: fakeFetch(500, {}).fn }).send({ to: "+1", body: "x" });
    expect(server).toMatchObject({ ok: false, permanent: false });
  });
});

describe("log providers", () => {
  it("always succeed so the demo works with no keys", async () => {
    const p = logProviders(() => undefined);
    expect((await p.email.send({ to: "a@b.c", subject: "s", html: "h", text: "t" })).ok).toBe(true);
    expect((await p.sms.send({ to: "+1", body: "b" })).ok).toBe(true);
    expect((await p.push.send({ subscription: { endpoint: "e", p256dh: "k", auth: "a" }, title: "t", body: "b", url: "/" })).ok).toBe(true);
  });
});
