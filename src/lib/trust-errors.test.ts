import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/errors";
import { toTrustError } from "./trust-errors";

describe("toTrustError", () => {
  it("turns known database codes into friendly conflicts", () => {
    const e = toTrustError({ code: "BR002", message: "the review window has closed" }, "review");
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(409);
    expect(e.message).toMatch(/14 days/);
  });
  it("uses 403 for not-a-party and 404 for missing rows", () => {
    expect(toTrustError({ code: "BR003", message: "x" }, "review").status).toBe(403);
    expect(toTrustError({ code: "BD002", message: "x" }, "dispute").status).toBe(403);
    expect(toTrustError({ code: "P0002", message: "x" }, "dispute").status).toBe(404);
  });
  it("maps duplicates to a conflict that says what already exists", () => {
    expect(toTrustError({ code: "23505", message: "dup" }, "review").message).toMatch(/already/);
    expect(toTrustError({ code: "23505", message: "dup" }, "dispute").status).toBe(409);
  });
  it("uses 400 for out-of-range amounts and bad input", () => {
    expect(toTrustError({ code: "BD004", message: "a claim cannot exceed the deposit held" }, "dispute").status).toBe(400);
    expect(toTrustError({ code: "23514", message: "check" }, "review").status).toBe(400);
  });
  it("wraps anything unknown as an internal error", () => {
    const e = toTrustError({ code: "XX000", message: "boom" }, "dispute");
    expect(e.status).toBe(500);
    expect(e.message).not.toMatch(/boom/);
  });
});
