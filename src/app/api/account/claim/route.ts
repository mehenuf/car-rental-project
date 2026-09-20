import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/account/claim — attaches the guest bookings made with the signed-in account's own,
 * verified email address. The database refuses unverified emails, so nobody can claim
 * someone else's booking by typing their address.
 */
export const POST = withErrorHandling(async () => {
  const user = await requireUser();
  if (!user.email || !user.email_confirmed_at) {
    throw new ApiError(403, "Verify your email address before claiming bookings.");
  }
  const { data, error } = await supabaseAdmin.rpc("claim_guest_bookings", {
    p_user_id: user.id,
    p_email: user.email,
  });
  if (error) {
    if (error.code === "BA002") throw new ApiError(403, "Verify your email address before claiming bookings.");
    throw new Error(`claim: ${error.message}`);
  }
  return NextResponse.json({ claimed: data ?? 0 });
});
