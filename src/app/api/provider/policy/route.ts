import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { policyFormToRow, policyRowToForm, type PolicyRow } from "@/lib/provider/pricing-forms";
import { PolicySchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

const DEFAULT_ROW: PolicyRow = {
  deposit_type: "fixed",
  deposit_value: 0,
  cancellation_tiers: [],
  min_driver_age: 21,
  young_driver_age: null,
  young_driver_fee_minor: 0,
};

/** GET /api/provider/policy — deposit, cancellation tiers and driver-age rules, in the units a person types. */
export const GET = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const { data, error } = await supabaseAdmin.from("provider_policies").select("*").eq("provider_id", providerId).maybeSingle();
  if (error) throw new Error(`policy: ${error.message}`);

  const row: PolicyRow = data
    ? {
        deposit_type: data.deposit_type,
        deposit_value: data.deposit_value,
        cancellation_tiers: (Array.isArray(data.cancellation_tiers) ? data.cancellation_tiers : []) as PolicyRow["cancellation_tiers"],
        min_driver_age: data.min_driver_age,
        young_driver_age: data.young_driver_age,
        young_driver_fee_minor: data.young_driver_fee_minor,
      }
    : DEFAULT_ROW;
  return NextResponse.json({ data: policyRowToForm(row, membership.provider.defaultCurrency), currency: membership.provider.defaultCurrency });
});

/** PUT /api/provider/policy — applies to new quotes; bookings already made keep the terms they were quoted. */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const input = PolicySchema.parse(await request.json());
  const row = policyFormToRow(input, membership.provider.defaultCurrency);

  const { error } = await supabaseAdmin.from("provider_policies").upsert({ provider_id: providerId, ...row });
  if (error) throw new Error(`policy: ${error.message}`);
  return NextResponse.json({ ok: true });
});
