import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, RateLimitError } from "@/lib/errors";
import { requireUser } from "@/lib/account/session";
import { verifierFromEnv } from "@/lib/comms/phone-verify";
import { PhoneStartSchema, PhoneVerifySchema } from "@/lib/comms/settings";
import { createRateLimiter } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

// Each code costs an SMS, so starting a verification is tightly limited per account.
const isStartLimited = createRateLimiter({ name: "account/notifications/phone", limit: 3, windowMs: 10 * 60_000 });

/** POST /api/account/notifications/phone — starts verification of a phone number (sends a code). */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  if (await isStartLimited(user.id)) throw new RateLimitError();
  const { phone } = PhoneStartSchema.parse(await request.json());

  const result = await verifierFromEnv().start(phone);
  if (!result.ok) throw new ApiError(502, "We could not send the code. Please try again.");

  // The number is saved unverified; any earlier verification of a different number is cleared.
  const { error } = await supabaseAdmin
    .from("contact_channels")
    .upsert({ user_id: user.id, phone_e164: phone, phone_verified_at: null, sms_opt_in: false, sms_opt_in_at: null }, { onConflict: "user_id" });
  if (error) throw new Error(`phone: ${error.message}`);
  return NextResponse.json({ ok: true });
});

/** PUT /api/account/notifications/phone — checks the code and marks the number verified. */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const { code } = PhoneVerifySchema.parse(await request.json());
  const { data: contact } = await supabaseAdmin.from("contact_channels").select("phone_e164").eq("user_id", user.id).maybeSingle();
  if (!contact?.phone_e164) throw new ApiError(400, "Add a phone number first.");

  if (!(await verifierFromEnv().check(contact.phone_e164, code))) throw new ApiError(400, "That code is not correct.");
  const { error } = await supabaseAdmin.from("contact_channels").update({ phone_verified_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) throw new Error(`phone: ${error.message}`);
  return NextResponse.json({ ok: true });
});
