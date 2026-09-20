import { ApiError } from "@/lib/errors";

export type QuoteErrorCode =
  | "UNSUPPORTED_CURRENCY"
  | "MIN_DAYS"
  | "MAX_DAYS"
  | "UNKNOWN_EXTRA"
  | "EXTRA_QUANTITY"
  | "DRIVER_TOO_YOUNG"
  | "PROMO_INVALID"
  | "NO_RATE_PLAN"
  | "CURRENCY_MISMATCH"
  | "BAD_INPUT";

/** A quote request that cannot be priced. Surfaces as a 400 with a machine-readable `code`. */
export class QuoteError extends ApiError {
  readonly code: QuoteErrorCode;

  constructor(code: QuoteErrorCode, message: string) {
    super(400, message);
    this.name = "QuoteError";
    this.code = code;
  }
}
