import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, RateLimitError } from "@/lib/errors";
import { SignupSchema } from "@/lib/schemas";
import { checkBreached } from "@/lib/account/password";
import { signupMode } from "@/lib/account/schemas";
import { hasLocale } from "@/lib/i18n/locales";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";

// A public, unauthenticated endpoint that creates a real Supabase Auth user on every success;
// without a throttle a script could mass-create accounts.
const isRateLimited = createRateLimiter({ limit: 5, windowMs: 60_000 });

/**
 * POST /api/auth/signup
 *
 * Creates the customer's account. By default the account starts unconfirmed and Supabase emails a
 * verification link (through the project's SMTP settings, ideally Resend); the response says
 * `needsVerification` so the page can ask the customer to check their inbox. Passwords must be at
 * least 10 characters and must not appear in known breaches (k-anonymity check, fails open).
 *
 * `AUTH_REQUIRE_EMAIL_VERIFICATION=false` keeps the earlier behaviour for demos that have no email
 * provider yet: the account is created pre-confirmed so the customer can sign in immediately.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (isRateLimited(getVisitorId(request))) throw new RateLimitError();

  const body = await request.json();
  const { fullName, email, password } = SignupSchema.parse(body);

  const { breached } = await checkBreached(password);
  if (breached) {
    throw new ApiError(400, "That password has appeared in a known data breach. Please choose a different one.");
  }

  if (signupMode(process.env) === "preconfirm") {
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
    return NextResponse.json({ ok: true, needsVerification: false }, { status: 201 });
  }

  // The anon client sends the confirmation email; the service role client would create the user silently.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const lang = request.headers.get("x-bc-lang") ?? "en";
  const origin = request.nextUrl.origin;
  const { error } = await anon.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/${hasLocale(lang) ? lang : "en"}/account`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.status === 422) {
      throw new ApiError(409, "An account with this email already exists.");
    }
    throw new ApiError(error.status === 429 ? 429 : 400, error.message);
  }
  return NextResponse.json({ ok: true, needsVerification: true }, { status: 201 });
});
