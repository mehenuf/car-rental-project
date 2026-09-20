import { describe, expect, it } from "vitest";
import { buildRateLimiter as createRateLimiter, type HitFn } from "./rate-limit-core";

describe("createRateLimiter", () => {
  it("asks the shared store, keyed by limiter name and visitor", async () => {
    const calls: unknown[][] = [];
    const hit: HitFn = async (key, seconds, limit) => {
      calls.push([key, seconds, limit]);
      return { allowed: true };
    };
    const limited = createRateLimiter({ name: "quote", limit: 30, windowMs: 60_000, hit });
    expect(await limited("1.2.3.4")).toBe(false);
    expect(calls).toEqual([["quote:1.2.3.4", 60, 30]]);
  });

  it("refuses when the store says the limit is used up", async () => {
    const limited = createRateLimiter({ name: "x", limit: 1, windowMs: 1000, hit: async () => ({ allowed: false }) });
    expect(await limited("a")).toBe(true);
  });

  it("rounds a sub-second window up to one second", async () => {
    let seconds = 0;
    const limited = createRateLimiter({ name: "x", limit: 1, windowMs: 200, hit: async (_k, s) => ((seconds = s), { allowed: true }) });
    await limited("a");
    expect(seconds).toBe(1);
  });

  it("falls back to a local limit when the store is unreachable, so abuse is still slowed", async () => {
    const limited = createRateLimiter({ name: "x", limit: 2, windowMs: 60_000, hit: async () => { throw new Error("db down"); } });
    expect(await limited("a")).toBe(false);
    expect(await limited("a")).toBe(false);
    expect(await limited("a")).toBe(true);
    expect(await limited("b")).toBe(false);
  });
});
