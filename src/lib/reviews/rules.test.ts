import { describe, expect, it } from "vitest";
import {
  ReviewInputSchema,
  bayesAverage,
  canEditReview,
  isReviewWindowOpen,
  reviewWindowEnds,
  shouldReveal,
} from "./rules";

describe("bayesAverage", () => {
  it("matches the database: (3 * 4.0 + sum) / (3 + n), rounded to two places", () => {
    expect(bayesAverage(0, 0)).toBe(4);
    expect(bayesAverage(5, 1)).toBe(4.25);
    expect(bayesAverage(50, 10)).toBe(4.77);
    expect(bayesAverage(2, 1)).toBe(3.5);
  });
});

describe("review window", () => {
  const completed = new Date("2026-06-01T12:00:00Z");
  it("ends 14 days after the return", () => {
    expect(reviewWindowEnds(completed).toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });
  it("is open until then and closed after", () => {
    expect(isReviewWindowOpen(completed, new Date("2026-06-15T11:59:59Z"))).toBe(true);
    expect(isReviewWindowOpen(completed, new Date("2026-06-15T12:00:01Z"))).toBe(false);
  });
});

describe("shouldReveal", () => {
  const completed = new Date("2026-06-01T12:00:00Z");
  it("reveals when both sides have reviewed", () => {
    expect(shouldReveal({ bothSubmitted: true, completedAt: completed, now: new Date("2026-06-02T00:00:00Z") })).toBe(true);
  });
  it("reveals a lone review only once the window has ended", () => {
    expect(shouldReveal({ bothSubmitted: false, completedAt: completed, now: new Date("2026-06-10T00:00:00Z") })).toBe(false);
    expect(shouldReveal({ bothSubmitted: false, completedAt: completed, now: new Date("2026-06-15T12:00:00Z") })).toBe(true);
  });
});

describe("canEditReview", () => {
  const submitted = new Date("2026-06-02T12:00:00Z");
  it("allows edits for 48 hours while still hidden", () => {
    expect(canEditReview({ status: "hidden", submittedAt: submitted, now: new Date("2026-06-04T11:59:00Z") })).toBe(true);
    expect(canEditReview({ status: "hidden", submittedAt: submitted, now: new Date("2026-06-04T12:01:00Z") })).toBe(false);
  });
  it("never allows editing a published or removed review", () => {
    expect(canEditReview({ status: "published", submittedAt: submitted, now: new Date("2026-06-02T13:00:00Z") })).toBe(false);
    expect(canEditReview({ status: "removed", submittedAt: submitted, now: new Date("2026-06-02T13:00:00Z") })).toBe(false);
  });
});

describe("ReviewInputSchema", () => {
  it("accepts the customer aspects and a comment", () => {
    const r = ReviewInputSchema("customer_to_provider").safeParse({ overall: 5, aspects: { cleanliness: 5, accuracy: 4, communication: 5, value: 4 }, comment: "Great" });
    expect(r.success).toBe(true);
  });
  it("accepts the provider aspects", () => {
    expect(ReviewInputSchema("provider_to_customer").safeParse({ overall: 4, aspects: { care: 5, communication: 4 } }).success).toBe(true);
  });
  it("rejects aspects that belong to the other direction, and out-of-range ratings", () => {
    expect(ReviewInputSchema("customer_to_provider").safeParse({ overall: 5, aspects: { care: 5 } }).success).toBe(false);
    expect(ReviewInputSchema("customer_to_provider").safeParse({ overall: 6 }).success).toBe(false);
    expect(ReviewInputSchema("customer_to_provider").safeParse({ overall: 3, aspects: { cleanliness: 0 } }).success).toBe(false);
  });
  it("trims and limits the comment", () => {
    const r = ReviewInputSchema("customer_to_provider").parse({ overall: 5, comment: "  Nice  " });
    expect(r.comment).toBe("Nice");
    expect(ReviewInputSchema("customer_to_provider").safeParse({ overall: 5, comment: "x".repeat(2001) }).success).toBe(false);
  });
});
