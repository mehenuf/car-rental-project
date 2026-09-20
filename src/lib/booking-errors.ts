import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";

export interface RpcError {
  code?: string;
  message: string;
}

/** Turns an error from one of the booking SQL functions into the API error
 * `withErrorHandling` should return. Unknown errors stay plain `Error`s so
 * they surface as a logged 500 without leaking internals. */
export function toBookingApiError(error: RpcError, context: string): Error {
  switch (error.code) {
    case "BC001":
      return new ConflictError("This booking cannot be moved to that status from its current state.");
    case "BC002":
      return new ConflictError("This vehicle is no longer available for the selected dates.");
    case "BC003":
      return new ApiError(400, "Unknown pick-up or drop-off location.");
    case "BC004":
      return new ApiError(400, "Drop-off must be after pick-up.");
    case "P0002":
      return new NotFoundError("Booking not found.");
    default:
      return new Error(`${context}: ${error.message}`);
  }
}
