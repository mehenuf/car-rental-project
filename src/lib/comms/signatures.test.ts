import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvix, verifyTwilio } from "./signatures";

const secretBytes = Buffer.from("super-secret-key-bytes-1234567890");
const secret = `whsec_${secretBytes.toString("base64")}`;

function svixHeaders(id: string, timestamp: string, body: string) {
  const sig = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${sig}` };
}

describe("verifySvix (Resend webhooks)", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  const ts = String(Math.floor(now.getTime() / 1000));
  const body = JSON.stringify({ type: "email.bounced" });

  it("accepts a correctly signed, fresh request", () => {
    expect(verifySvix(secret, svixHeaders("msg_1", ts, body), body, now)).toBe(true);
  });
  it("accepts when one of several signatures matches", () => {
    const h = svixHeaders("msg_1", ts, body);
    expect(verifySvix(secret, { ...h, "svix-signature": `v1,AAAA ${h["svix-signature"]}` }, body, now)).toBe(true);
  });
  it("rejects a tampered body or wrong secret", () => {
    expect(verifySvix(secret, svixHeaders("msg_1", ts, body), body + " ", now)).toBe(false);
    expect(verifySvix(`whsec_${Buffer.from("other").toString("base64")}`, svixHeaders("msg_1", ts, body), body, now)).toBe(false);
  });
  it("rejects stale timestamps (replay) and missing headers", () => {
    const old = String(Math.floor(now.getTime() / 1000) - 600);
    expect(verifySvix(secret, svixHeaders("msg_1", old, body), body, now)).toBe(false);
    expect(verifySvix(secret, {}, body, now)).toBe(false);
  });
});

describe("verifyTwilio", () => {
  const token = "twilio-auth-token";
  const url = "https://example.com/api/webhooks/twilio";
  const params = { MessageSid: "SM123", MessageStatus: "delivered", From: "+15550001111" };
  const sign = (u: string, p: Record<string, string>) =>
    createHmac("sha1", token)
      .update(u + Object.keys(p).sort().map((k) => k + p[k]).join(""))
      .digest("base64");

  it("accepts a valid signature", () => {
    expect(verifyTwilio(token, url, params, sign(url, params))).toBe(true);
  });
  it("rejects changed params, url or token", () => {
    expect(verifyTwilio(token, url, { ...params, MessageStatus: "failed" }, sign(url, params))).toBe(false);
    expect(verifyTwilio(token, url + "x", params, sign(url, params))).toBe(false);
    expect(verifyTwilio("wrong", url, params, sign(url, params))).toBe(false);
    expect(verifyTwilio(token, url, params, null)).toBe(false);
  });
});
