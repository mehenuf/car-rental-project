import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, RateLimitError } from "@/lib/errors";
import { eraseConfirmed } from "@/lib/account/erase";
import { requireUser } from "@/lib/account/session";
import { createRateLimiter } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

const isLimited = createRateLimiter({ name: "account/privacy/erase", limit: 3, windowMs: 60 * 60_000 });
const BodySchema = z.object({ confirm_email: z.string().max(320) });

/**
 * POST /api/account/privacy/erase — deletes the account. Personal data is removed or anonymised; booking, payment
 * and ledger rows stay (they carry no personal data afterwards) for the legally required retention period.
 * Refused while a booking is open or a dispute is unresolved.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  if (await isLimited(user.id)) throw new RateLimitError();
  const { confirm_email } = BodySchema.parse(await request.json());
  if (!eraseConfirmed(confirm_email, user.email)) throw new ApiError(400, "Type your account email exactly to confirm.");

  const { data: request_row } = await supabaseAdmin.from("data_requests").insert({ user_id: user.id, kind: "erase", status: "processing" }).select("id").single();

  // Licence photos live in private storage; remove the files before the rows that point at them.
  const { data: docs } = await supabaseAdmin.from("driver_documents").select("storage_path").eq("user_id", user.id);
  if (docs && docs.length > 0) await supabaseAdmin.storage.from("customer-documents").remove(docs.map((d) => d.storage_path));

  const { error } = await supabaseAdmin.rpc("erase_user", { p_user: user.id });
  if (error) {
    if (request_row) await supabaseAdmin.from("data_requests").update({ status: "rejected", note: error.message.slice(0, 200) }).eq("id", request_row.id);
    if (error.code === "BE001") throw new ApiError(409, "Finish or cancel your open bookings and settle any dispute first, then try again.");
    throw new Error(`erase: ${error.message}`);
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) throw new Error(`erase (auth): ${deleteError.message}`);
  return NextResponse.json({ ok: true });
});
