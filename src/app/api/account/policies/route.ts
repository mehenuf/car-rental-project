import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireUser } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/account/policies — terms or privacy versions the caller has not accepted yet. */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const { data, error } = await supabaseAdmin.rpc("policies_to_accept", { p_user: user.id });
  if (error) throw new Error(`policies_to_accept: ${error.message}`);
  return NextResponse.json({ pending: data ?? [] });
});

/** POST /api/account/policies — the caller accepts the current terms and privacy policy. */
export const POST = withErrorHandling(async () => {
  const user = await requireUser();
  const { data, error } = await supabaseAdmin.rpc("accept_policies", { p_user: user.id });
  if (error) throw new Error(`accept_policies: ${error.message}`);
  return NextResponse.json({ accepted: data ?? 0 });
});
