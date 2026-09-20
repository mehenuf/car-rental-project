import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { majorToMinor, minorToMajor } from "@/lib/pricing/money";
import { requireProviderAccess } from "@/lib/provider/context";
import { canAccessBranch } from "@/lib/provider/permissions";
import { bpToPct, parseSeasonRange, pctToBp } from "@/lib/provider/pricing-forms";
import { RatePlanUpsertSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/rate-plans — the provider's prices per model and branch, with their seasons, in the units a person types. */
export const GET = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");

  const { data: plans, error } = await supabaseAdmin
    .from("rate_plans")
    .select("id, vehicle_id, branch_id, currency, base_daily_minor, weekend_uplift_bp, weekly_discount_bp, monthly_discount_bp, min_days, max_days")
    .eq("provider_id", providerId);
  if (error) throw new Error(`rate plans: ${error.message}`);
  const visible = (plans ?? []).filter((p) => canAccessBranch(membership, p.branch_id));

  const planIds = visible.map((p) => p.id);
  const vehicleIds = [...new Set(visible.map((p) => p.vehicle_id))];
  const [seasons, vehicles, branches] = await Promise.all([
    planIds.length ? supabaseAdmin.from("rate_seasons").select("id, rate_plan_id, during, daily_minor").in("rate_plan_id", planIds) : Promise.resolve({ data: [] }),
    vehicleIds.length ? supabaseAdmin.from("vehicles").select("id, name").in("id", vehicleIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("branches").select("id, name, city").eq("provider_id", providerId),
  ]);
  const names = new Map((vehicles.data ?? []).map((v) => [v.id, v.name]));
  const branchNames = new Map((branches.data ?? []).map((b) => [b.id, `${b.name} (${b.city})`]));

  return NextResponse.json({
    data: visible.map((p) => ({
      id: p.id,
      vehicle_id: p.vehicle_id,
      vehicle_name: names.get(p.vehicle_id) ?? "Unknown model",
      branch_id: p.branch_id,
      branch_name: branchNames.get(p.branch_id) ?? "",
      currency: p.currency,
      base_daily: minorToMajor(p.base_daily_minor, p.currency),
      weekend_uplift_pct: bpToPct(p.weekend_uplift_bp),
      weekly_discount_pct: bpToPct(p.weekly_discount_bp),
      monthly_discount_pct: bpToPct(p.monthly_discount_bp),
      min_days: p.min_days,
      max_days: p.max_days,
      seasons: (seasons.data ?? [])
        .filter((s) => s.rate_plan_id === p.id)
        .map((s) => ({ id: s.id, ...parseSeasonRange(s.during), daily: minorToMajor(s.daily_minor, p.currency) })),
    })),
  });
});

/** PUT /api/provider/rate-plans — creates or updates the price of a model at a branch. You can only price models you have a car of at that branch. */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const input = RatePlanUpsertSchema.parse(await request.json());

  const { data: branch, error } = await supabaseAdmin
    .from("branches")
    .select("id, currency")
    .eq("id", input.branch_id)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw new Error(`rate plans: ${error.message}`);
  if (!branch) throw new NotFoundError("Branch not found.");
  if (!canAccessBranch(membership, branch.id)) throw new ApiError(403, "You can only manage your own branch.");

  const { count } = await supabaseAdmin
    .from("fleet_units")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .eq("branch_id", branch.id)
    .eq("vehicle_id", input.vehicle_id);
  if ((count ?? 0) === 0) throw new ConflictError("You have no car of this model at this branch.");

  const { data, error: upsertError } = await supabaseAdmin
    .from("rate_plans")
    .upsert(
      {
        provider_id: providerId,
        vehicle_id: input.vehicle_id,
        branch_id: branch.id,
        currency: branch.currency,
        base_daily_minor: majorToMinor(input.base_daily, branch.currency),
        weekend_uplift_bp: pctToBp(input.weekend_uplift_pct),
        weekly_discount_bp: pctToBp(input.weekly_discount_pct),
        monthly_discount_bp: pctToBp(input.monthly_discount_pct),
        min_days: input.min_days,
        max_days: input.max_days ?? null,
      },
      { onConflict: "vehicle_id,branch_id" }
    )
    .select("id")
    .single();
  if (upsertError) throw new Error(`rate plans: ${upsertError.message}`);
  return NextResponse.json({ id: data.id });
});
