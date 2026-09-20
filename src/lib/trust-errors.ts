import { ApiError } from "@/lib/errors";

interface DbError {
  code?: string;
  message: string;
}

const KNOWN: Record<string, [number, string]> = {
  BR001: [409, "Only a completed rental can be reviewed."],
  BR002: [409, "The review window has closed. Reviews are open for 14 days after the return."],
  BR003: [403, "You can only review your own bookings."],
  BR004: [409, "The renter has no account, so there is no one to review."],
  BR005: [409, "This review can no longer be edited. Reviews can be edited for 48 hours, until they are published."],
  BR006: [409, "This review cannot be replied to."],
  BR007: [400, "A reason is required."],
  BD001: [409, "Disputes must be opened within 48 hours of the return."],
  BD002: [403, "You are not part of this booking."],
  BD003: [400, "That is not allowed for this kind of dispute."],
  BD005: [409, "This dispute is closed."],
  BD006: [409, "Wait for the other side to respond first."],
  BS001: [409, "Accept the insurance declaration before submitting a car."],
  BS002: [403, "This account is suspended."],
  BP011: [409, "This booking is held for review and cannot be handed over yet."],
  P0002: [404, "Not found."],
};

const DUPLICATE = {
  review: "You have already reviewed this booking, or you have already replied to this review.",
  dispute: "A dispute is already open for this booking.",
  report: "You have already reported this.",
} as const;

/** Maps the database's custom error codes to API errors with plain-language messages. */
export function toTrustError(error: DbError, subject: "review" | "dispute" | "report"): ApiError {
  if (error.code === "BD004") return new ApiError(400, humanAmountMessage(error.message));
  if (error.code === "23505") return new ApiError(409, DUPLICATE[subject]);
  if (error.code === "23514") return new ApiError(400, "Some of the values are not allowed.");
  const known = error.code ? KNOWN[error.code] : undefined;
  if (known) return new ApiError(known[0], known[1]);
  console.error(`trust error (${subject}):`, error.message);
  return new ApiError(500, "Something went wrong. Please try again.");
}

function humanAmountMessage(message: string): string {
  if (/exceed the deposit/i.test(message)) return "A claim cannot be more than the deposit that was held.";
  if (/exceed the amount paid/i.test(message)) return "A claim cannot be more than the amount paid.";
  if (/out of range/i.test(message)) return "That offer is outside the allowed range.";
  return "That amount is not allowed.";
}
