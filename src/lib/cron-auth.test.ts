import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/errors";
import { verifyCronAuth } from "@/lib/cron-auth";

const SECRET = "a-long-random-cron-secret-1234567890";

describe("verifyCronAuth", () => {
  it("accepts the right bearer token", () => {
    expect(() => verifyCronAuth(`Bearer ${SECRET}`, SECRET)).not.toThrow();
  });

  it("rejects a missing, wrong or malformed header with 401", () => {
    for (const header of [null, "", "Bearer wrong", SECRET, `Basic ${SECRET}`]) {
      try {
        verifyCronAuth(header, SECRET);
        throw new Error("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
    }
  });

  it("answers 503 when no secret is configured, so an open endpoint is never exposed", () => {
    try {
      verifyCronAuth(`Bearer anything`, undefined);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(503);
    }
  });
});
