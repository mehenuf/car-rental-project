import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent, parseDsn, reportError, scrub } from "./observability";

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

describe("reportError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("only logs when no DSN is set", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await reportError(new Error("boom for a@b.co"), { digest: "d1" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0]?.[0])).toContain("boom for [email]");
  });

  it("sends a scrubbed envelope to Sentry and never throws", async () => {
    vi.stubEnv("SENTRY_DSN", "https://abc@o1.ingest.sentry.io/42");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await reportError(new Error("x"), { email: "a@b.co", path: "/p" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://o1.ingest.sentry.io/api/42/envelope/");
    expect(String(init.body)).not.toContain("a@b.co");
    expect(String(init.body)).toContain("/p");

    fetchSpy.mockRejectedValue(new Error("network"));
    await expect(reportError(new Error("y"))).resolves.toBeUndefined();
  });

  it("logs structured lines", () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logEvent("info", "hello", { token: "t" });
    const line = JSON.parse(String(out.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ level: "info", message: "hello", token: "[redacted]" });
  });
});
