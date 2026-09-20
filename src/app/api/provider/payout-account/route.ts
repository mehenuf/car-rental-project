import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { PayoutAccountSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/payout-account — masked payout details (never the full number). */
export const GET = withErrorHandling(async () => {
  const { providerId } = await requireProviderAccess("payouts.read");
  const { data, error } = await supabaseAdmin
    .from("payout_accounts")
    .select("account_holder, bank_name, account_last4, country_code, updated_at")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw new Error(`payout account: ${error.message}`);
  return NextResponse.json({ data });
});

/** PUT /api/provider/payout-account — owners set where earnings are paid. Only the last four digits are stored. */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const { providerId } = await requireProviderAccess("payout_account.write");
  const input = PayoutAccountSchema.parse(await request.json());

  const last4 = input.account_number.slice(-4);
  if (!/^\d{4}$/.test(last4)) throw new ApiError(400, "The account number must end in four digits.");

  const { data, error } = await supabaseAdmin
    .from("payout_accounts")
    .upsert({
      provider_id: providerId,
      account_holder: input.account_holder,
      bank_name: input.bank_name,
      account_last4: last4,
      country_code: input.country_code,
      updated_at: new Date().toISOString(),
    })
    .select("account_holder, bank_name, account_last4, country_code")
    .single();
  if (error) throw new Error(`payout account: ${error.message}`);
  return NextResponse.json({ data });
});
