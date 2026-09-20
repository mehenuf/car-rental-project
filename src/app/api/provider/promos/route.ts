import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { majorToMinor, minorToMajor } from "@/lib/pricing/money";
import { requireProviderAccess } from "@/lib/provider/context";
import { bpToPct, pctToBp } from "@/lib/provider/pricing-forms";
import { PromoSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/promos — the provider's own promo codes (platform promos are managed by the platform). */
export const GET = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .select("id, code, discount_type, value, currency, valid_during, min_days, vehicle_id, is_active")
    .eq("provider_id", providerId)
    .eq("issuer", "provider")
    .order("code", { ascending: true });
  if (error) throw new Error(`promos: ${error.message}`);

  const currency = membership.provider.defaultCurrency;
  return NextResponse.json({
    data: (data ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      discount_type: p.discount_type,
      value: p.discount_type === "percent" ? bpToPct(p.value) : minorToMajor(p.value, p.currency ?? currency),
      currency: p.currency,
      valid_during: p.valid_during,
      min_days: p.min_days,
      vehicle_id: p.vehicle_id,
      is_active: p.is_active,
    })),
  });
});

/** POST /api/provider/promos — creates a promo code that only applies to this provider's cars. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const input = PromoSchema.parse(await request.json());
  const currency = membership.provider.defaultCurrency;

  if (input.vehicle_id) {
    const { count } = await supabaseAdmin
      .from("fleet_units")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .eq("vehicle_id", input.vehicle_id);
    if ((count ?? 0) === 0) throw new NotFoundError("You have no car of that model.");
  }

  const validDuring =
    input.valid_from || input.valid_to
      ? `[${input.valid_from ? `${input.valid_from}T00:00:00Z` : ""},${input.valid_to ? `${new Date(Date.parse(input.valid_to) + 86_400_000).toISOString()}` : ""})`
      : null;

  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .insert({
      code: input.code,
      issuer: "provider",
      provider_id: providerId,
      discount_type: input.discount_type,
      value: input.discount_type === "percent" ? pctToBp(input.value) : majorToMinor(input.value, currency),
      currency: input.discount_type === "fixed" ? currency : null,
      valid_during: validDuring,
      min_days: input.min_days,
      vehicle_id: input.vehicle_id ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new ConflictError("This code is already in use. Choose another.");
    throw new Error(`promos: ${error.message}`);
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
});
