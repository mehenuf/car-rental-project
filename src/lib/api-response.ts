import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/errors";

export interface ApiErrorBody {
  error: {
    message: string;
    issues?: { path: string; message: string }[];
  };
}

/**
 * Every route handler's error path goes through this, so every route in
 * src/app/api/ fails in the same shape: `{ error: { message, issues? } }`.
 *
 * - ZodError (bad query params / body)      -> 400, with per-field issues
 * - SyntaxError (malformed `request.json()`) -> 400
 * - ApiError / NotFoundError (thrown by route or query code) -> its status
 * - anything else                            -> 500, logged, no internals leaked
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          issues: error.issues.map((issue) => ({
            path: issue.path.join(".") || "(root)",
            message: issue.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json({ error: { message: error.message } }, { status: error.status });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: { message: "Internal server error" } },
    { status: 500 }
  );
}

/** Wraps a route handler so every thrown error is normalized by `handleApiError`. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
