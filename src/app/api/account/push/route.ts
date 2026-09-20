import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireUser } from "@/lib/account/session";
import { PushSubscriptionSchema } from "@/lib/comms/settings";
import { supabaseAdmin } from "@/lib/supabase-server";

const MAX_DEVICES = 10;

/** POST /api/account/push — saves this browser's push subscription for the signed-in account. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const sub = PushSubscriptionSchema.parse(await request.json());

  const { count } = await supabaseAdmin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= MAX_DEVICES) {
    // Drop the oldest so a returning user is never stuck at the limit.
    const { data: oldest } = await supabaseAdmin.from("push_subscriptions").select("id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
    if (oldest) await supabaseAdmin.from("push_subscriptions").delete().eq("id", oldest.id);
  }

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(`push: ${error.message}`);
  return NextResponse.json({ ok: true }, { status: 201 });
});

/** DELETE /api/account/push — removes this browser's subscription. */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await request.json());
  await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
});
