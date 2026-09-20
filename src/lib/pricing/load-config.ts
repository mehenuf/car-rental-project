import "server-only";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { QuoteError } from "@/lib/pricing/errors";
import {
  commissionBpFor,
  mapExtra,
  mapPolicy,
  mapPromo,
  mapRatePlan,
  mapTaxRule,
} from "@/lib/pricing/mappers";
import type { QuoteConfig } from "@/lib/pricing/types";
import { supabaseAdmin } from "@/lib/supabase-server";

export interface LoadConfigArgs {
  vehicleId: string;
  pickupBranchId: number;
  dropoffBranchId: number;
  promoCode: string | null;
}

/** Escapes the ILIKE wildcards so a promo code is matched literally (case-insensitively). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function fail(step: string, message: string): never {
  throw new Error(`loadQuoteConfig(${step}): ${message}`);
}

/**
 * Gathers everything the pure `quote()` function needs for one trip: the
 * pickup branch's provider, rate plan, seasons, extras, policy, fees, tax
 * rules, the resolved promo and the platform settings.
 */
export async function loadQuoteConfig(args: LoadConfigArgs): Promise<QuoteConfig> {
  const { vehicleId, pickupBranchId, dropoffBranchId, promoCode } = args;

  const { data: branches, error: branchError } = await supabaseAdmin
    .from("branches")
    .select("id, provider_id, currency, timezone, country_code, pickup_surcharge_minor, is_active")
    .in("id", [pickupBranchId, dropoffBranchId]);
  if (branchError) fail("branches", branchError.message);

  const pickup = branches?.find((b) => b.id === pickupBranchId);
  const dropoff = branches?.find((b) => b.id === dropoffBranchId);
  if (!pickup || !dropoff) throw new NotFoundError("Unknown pick-up or drop-off location.");
  if (!pickup.is_active || !dropoff.is_active) {
    throw new ConflictError("This location is not available for booking right now.");
  }
  if (pickup.provider_id !== dropoff.provider_id) {
    throw new QuoteError("BAD_INPUT", "Pick-up and drop-off must be at the same rental company.");
  }
  const providerId = pickup.provider_id;

  const [provider, plan, extras, policy, oneWay, taxRules, settings, promo] = await Promise.all([
    supabaseAdmin
      .from("providers")
      .select("status, commission_rate_override")
      .eq("id", providerId)
      .maybeSingle(),
    supabaseAdmin
      .from("rate_plans")
      .select("id, currency, base_daily_minor, weekend_uplift_bp, weekly_discount_bp, monthly_discount_bp, min_days, max_days")
      .eq("vehicle_id", vehicleId)
      .eq("branch_id", pickupBranchId)
      .maybeSingle(),
    supabaseAdmin
      .from("extras")
      .select("code, name, kind, pricing, unit_price_minor, max_quantity, cap_minor, is_mandatory")
      .eq("provider_id", providerId)
      .eq("currency", pickup.currency)
      .eq("is_active", true)
      .order("code", { ascending: true }),
    supabaseAdmin.from("provider_policies").select("*").eq("provider_id", providerId).maybeSingle(),
    pickupBranchId === dropoffBranchId
      ? Promise.resolve({ data: null, error: null })
      : supabaseAdmin
          .from("one_way_fees")
          .select("amount_minor")
          .eq("from_branch_id", pickupBranchId)
          .eq("to_branch_id", dropoffBranchId)
          .maybeSingle(),
    supabaseAdmin
      .from("tax_rules")
      .select("name, rate_bp, applies_to, inclusive")
      .eq("country_code", pickup.country_code)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabaseAdmin.from("platform_settings").select("commission_bp, service_fee_bp").maybeSingle(),
    promoCode
      ? supabaseAdmin
          .from("promo_codes")
          .select("code, issuer, provider_id, discount_type, value, currency, valid_during, min_days, vehicle_id")
          .ilike("code", escapeLike(promoCode.trim()))
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  for (const [step, result] of Object.entries({ provider, plan, extras, policy, oneWay, taxRules, settings, promo })) {
    if (result.error) fail(step, result.error.message);
  }

  if (!provider.data || provider.data.status !== "approved") {
    throw new ConflictError("This vehicle is no longer available for booking.");
  }
  if (!plan.data) {
    throw new QuoteError("NO_RATE_PLAN", "This vehicle has no price set for the selected location.");
  }
  if (plan.data.currency !== pickup.currency) {
    throw new QuoteError("CURRENCY_MISMATCH", "This vehicle's price is not set in the location's currency.");
  }

  const { data: seasons, error: seasonError } = await supabaseAdmin
    .from("rate_seasons")
    .select("during, daily_minor")
    .eq("rate_plan_id", plan.data.id);
  if (seasonError) fail("rate_seasons", seasonError.message);

  // A promo resolves only if it is a platform promo or belongs to this provider.
  const promoRow =
    promo.data && (promo.data.issuer === "platform" || promo.data.provider_id === providerId) ? promo.data : null;

  return {
    currency: pickup.currency,
    timezone: pickup.timezone,
    ratePlan: mapRatePlan(plan.data, seasons ?? []),
    extras: (extras.data ?? []).map(mapExtra),
    policy: mapPolicy(policy.data),
    oneWayFeeMinor: oneWay.data?.amount_minor ?? 0,
    pickupSurchargeMinor: pickup.pickup_surcharge_minor,
    taxRules: (taxRules.data ?? []).map(mapTaxRule),
    promo: promoRow ? mapPromo(promoRow) : null,
    commissionBp: commissionBpFor(provider.data.commission_rate_override, settings.data?.commission_bp ?? 1500),
    serviceFeeBp: settings.data?.service_fee_bp ?? 0,
  };
}
