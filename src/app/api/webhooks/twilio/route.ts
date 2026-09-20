import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { verifyTwilio } from "@/lib/comms/signatures";
import { supabaseAdmin } from "@/lib/supabase-server";

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

/**
 * POST /api/webhooks/twilio — delivery status callbacks and inbound replies. Authenticated by
 * Twilio's signature over the URL and form fields. A STOP reply opts the number out at once.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) throw new ApiError(503, "Twilio webhooks are not configured.");

  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") params[key] = value;

  const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin}${request.nextUrl.pathname}`;
  if (!verifyTwilio(token, publicUrl, params, request.headers.get("x-twilio-signature"))) {
    throw new ApiError(401, "Invalid signature.");
  }

  const sid = params.MessageSid;
  const status = params.MessageStatus ?? params.SmsStatus;
  if (sid && status === "delivered") {
    await supabaseAdmin.from("notifications").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("provider", "twilio").eq("provider_ref", sid);
  } else if (sid && (status === "failed" || status === "undelivered")) {
    await supabaseAdmin.from("notifications").update({ status: "failed", error: params.ErrorCode ?? status }).eq("provider", "twilio").eq("provider_ref", sid);
  }

  const body = (params.Body ?? "").trim().toUpperCase();
  if (params.From && STOP_WORDS.has(body)) {
    await supabaseAdmin.from("suppressions").upsert({ channel: "sms", address: params.From, reason: "opt_out" }, { onConflict: "channel,address", ignoreDuplicates: true });
    await supabaseAdmin.from("contact_channels").update({ sms_opt_in: false }).eq("phone_e164", params.From);
  }
  // Twilio expects TwiML; an empty response sends no auto-reply.
  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
});
