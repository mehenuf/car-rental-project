import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { verifySvix } from "@/lib/comms/signatures";
import { supabaseAdmin } from "@/lib/supabase-server";

interface ResendEvent {
  type: string;
  data?: { email_id?: string; to?: string[] };
}

/**
 * POST /api/webhooks/resend — delivery, bounce and complaint callbacks. Authenticated by the Svix
 * signature over the raw body. Hard bounces and complaints add the address to the suppression list
 * so it is never mailed again.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, "Resend webhooks are not configured.");

  const raw = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? undefined,
    "svix-timestamp": request.headers.get("svix-timestamp") ?? undefined,
    "svix-signature": request.headers.get("svix-signature") ?? undefined,
  };
  if (!verifySvix(secret, headers, raw)) throw new ApiError(401, "Invalid signature.");

  const event = JSON.parse(raw) as ResendEvent;
  const ref = event.data?.email_id;

  if (event.type === "email.delivered" && ref) {
    await supabaseAdmin.from("notifications").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("provider", "resend").eq("provider_ref", ref);
  } else if ((event.type === "email.bounced" || event.type === "email.complained") && ref) {
    await supabaseAdmin.from("notifications").update({ status: "bounced" }).eq("provider", "resend").eq("provider_ref", ref);
    for (const address of event.data?.to ?? []) {
      await supabaseAdmin
        .from("suppressions")
        .upsert({ channel: "email", address: address.trim().toLowerCase(), reason: event.type === "email.bounced" ? "bounce" : "complaint" }, { onConflict: "channel,address", ignoreDuplicates: true });
    }
  }
  return NextResponse.json({ received: true });
});
