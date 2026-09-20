import { z } from "zod";

const DAY_MS = 86_400_000;
export const REVIEW_WINDOW_DAYS = 14;
export const REVIEW_EDIT_HOURS = 48;

/** Same formula as `bayes_rating` in the database: a prior of 4.0 worth three reviews. */
export function bayesAverage(sum: number, count: number): number {
  return Math.round(((3 * 4 + sum) / (3 + count)) * 100) / 100;
}

export function reviewWindowEnds(completedAt: Date): Date {
  return new Date(completedAt.getTime() + REVIEW_WINDOW_DAYS * DAY_MS);
}

export function isReviewWindowOpen(completedAt: Date, now: Date): boolean {
  return now.getTime() <= reviewWindowEnds(completedAt).getTime();
}

/** Double-blind: a review appears when both sides have submitted, or the 14 days have ended. */
export function shouldReveal(input: { bothSubmitted: boolean; completedAt: Date; now: Date }): boolean {
  return input.bothSubmitted || input.now.getTime() >= reviewWindowEnds(input.completedAt).getTime();
}

export function canEditReview(input: { status: "hidden" | "published" | "removed"; submittedAt: Date; now: Date }): boolean {
  return (
    input.status === "hidden" && input.now.getTime() <= input.submittedAt.getTime() + REVIEW_EDIT_HOURS * 3_600_000
  );
}

export const CUSTOMER_ASPECTS = ["cleanliness", "accuracy", "communication", "value"] as const;
export const PROVIDER_ASPECTS = ["care", "communication"] as const;

const star = z.number().int().min(1).max(5);

/** Ratings from 1 to 5 overall and per aspect, with an optional comment. */
export function ReviewInputSchema(direction: "customer_to_provider" | "provider_to_customer") {
  const keys = direction === "customer_to_provider" ? CUSTOMER_ASPECTS : PROVIDER_ASPECTS;
  return z.object({
    overall: star,
    aspects: z
      .object(Object.fromEntries(keys.map((k) => [k, star.optional()])) as Record<string, z.ZodOptional<typeof star>>)
      .strict()
      .default({}),
    comment: z.string().trim().max(2000).optional(),
  });
}
