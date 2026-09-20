import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { RateLimitError } from "@/lib/errors";
import { requireUser } from "@/lib/account/session";
import { createRateLimiter } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

const isLimited = createRateLimiter({ name: "account/privacy/export", limit: 3, windowMs: 60 * 60_000 });

/** GET /api/account/privacy/export — everything we hold about the signed-in person, as a JSON download. */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  if (await isLimited(user.id)) throw new RateLimitError();

  const { data, error } = await supabaseAdmin.rpc("export_user_data", { p_user: user.id });
  if (error) throw new Error(`export: ${error.message}`);
  await supabaseAdmin.from("data_requests").insert({ user_id: user.id, kind: "export", status: "done", completed_at: new Date().toISOString() });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bestcar-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
