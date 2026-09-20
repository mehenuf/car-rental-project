import { describe, expect, it } from "vitest";
import { parseDsn, scrub } from "./observability";

describe("observability", () => {
  it("redacts sensitive keys and emails", () => {
    const out = scrub({ user: { email: "a@b.co", note: "mail me at a@b.co" }, authorization: "Bearer x", ok: 1 }) as { user: { email: string; note: string }; authorization: string; ok: number };
    expect(out.user.email).toBe("[redacted]");
    expect(out.user.note).toBe("mail me at [email]");
    expect(out.authorization).toBe("[redacted]");
    expect(out.ok).toBe(1);
  });
  it("parses a Sentry DSN into an envelope url", () => {
    expect(parseDsn("https://abc@o1.ingest.sentry.io/42")).toEqual({ url: "https://o1.ingest.sentry.io/api/42/envelope/", key: "abc" });
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("nonsense")).toBeNull();
  });
});
