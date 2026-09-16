import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, RateLimitError } from "@/lib/errors";
import { SignupSchema } from "@/lib/schemas";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";

// A public, unauthenticated endpoint that creates a real, pre-confirmed
// Supabase Auth user on every success — without this, a script could
// mass-create accounts with no throttle at all.
const isRateLimited = createRateLimiter({ limit: 5, windowMs: 60_000 });

/**
 * POST /api/auth/signup
 *
 * Creates the customer's account with the service-role client and marks the
 * email pre-confirmed. This project's Supabase auth has "Confirm email"
 * turned on, but there's no custom SMTP wired up — Supabase's shared mailer
 * is rate-limited and unreliable, so signups sent through the normal
 * `supabase.auth.signUp` flow were getting stuck waiting on a confirmation
 * email that never reliably arrives, leaving the account permanently unable
 * to log in. Creating the user here with `email_confirm: true` sidesteps
 * that dependency entirely. The client still calls
 * `supabase.auth.signInWithPassword` itself right after this succeeds, so
 * the actual browser session/cookie is established the normal way.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (isRateLimited(getVisitorId(request))) throw new RateLimitError();

  const body = await request.json();
  const { fullName, email, password } = SignupSchema.parse(body);

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    if (error.code === "email_exists" || error.status === 422) {
      throw new ApiError(409, "An account with this email already exists.");
    }
    throw new ApiError(400, error.message);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
});
