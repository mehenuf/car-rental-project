import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { canAccessBranch } from "@/lib/provider/permissions";
import { CreateUnitSchema } from "@/lib/provider/schemas";
import { majorToMinor } from "@/lib/pricing/money";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/units — the provider's cars with their model, branch and listing status. */
export const GET = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("provider.read");

  const { data: units, error } = await supabaseAdmin
    .from("fleet_units")
    .select("id, branch_id, vehicle_id, plate, vin, mileage_km, status, requires_window, listing_status, review_note")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`units: ${error.message}`);

  const visible = (units ?? []).filter((u) => canAccessBranch(membership, u.branch_id));
  const vehicleIds = [...new Set(visible.map((u) => u.vehicle_id))];
  const [vehicles, branches] = await Promise.all([
    vehicleIds.length ? supabaseAdmin.from("vehicles").select("id, name").in("id", vehicleIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("branches").select("id, name, city").eq("provider_id", providerId),
  ]);
  const names = new Map((vehicles.data ?? []).map((v) => [v.id, v.name]));
  const branchNames = new Map((branches.data ?? []).map((b) => [b.id, `${b.name} (${b.city})`]));

  return NextResponse.json({
    data: visible.map((u) => ({
      ...u,
      vehicle_name: names.get(u.vehicle_id) ?? "Unknown model",
      branch_name: branchNames.get(u.branch_id) ?? "",
    })),
  });
});

/**
 * POST /api/provider/units — adds a car. A company's cars are live at once; a
 * private owner's start as a draft and need admin approval. If this provider
 * has no price for the model at that branch yet, `daily_price` creates it, so
 * a car is never listed without one.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("fleet.write");
  const input = CreateUnitSchema.parse(await request.json());

  const { data: branch, error: branchError } = await supabaseAdmin
    .from("branches")
    .select("id, currency")
    .eq("id", input.branch_id)
    .eq("provider_id", providerId) // a branch id from the request is only valid if it is this provider's
    .maybeSingle();
  if (branchError) throw new Error(`units: ${branchError.message}`);
  if (!branch) throw new NotFoundError("Branch not found.");
  if (!canAccessBranch(membership, branch.id)) throw new ApiError(403, "You can only manage your own branch.");

  const { data: vehicle } = await supabaseAdmin.from("vehicles").select("id").eq("id", input.vehicle_id).maybeSingle();
  if (!vehicle) throw new NotFoundError("Model not found in the catalogue.");

  const { data: plan, error: planError } = await supabaseAdmin
    .from("rate_plans")
    .select("id")
    .eq("vehicle_id", input.vehicle_id)
    .eq("branch_id", branch.id)
    .maybeSingle();
  if (planError) throw new Error(`units: ${planError.message}`);
  if (!plan && !input.daily_price) throw new ApiError(400, "Set a daily price for this model at this branch.");

  const individual = membership.provider.type === "individual";
  const { data: unit, error: unitError } = await supabaseAdmin
    .from("fleet_units")
    .insert({
      provider_id: providerId,
      branch_id: branch.id,
      vehicle_id: input.vehicle_id,
      plate: input.plate,
      vin: input.vin ?? null,
      requires_window: individual,
      listing_status: individual ? "draft" : "approved",
    })
    .select("id, listing_status")
    .single();
  if (unitError) {
    if (unitError.code === "23505") throw new ConflictError("You already have a car with this plate.");
    throw new Error(`units: ${unitError.message}`);
  }

  if (!plan && input.daily_price) {
    const { error } = await supabaseAdmin.from("rate_plans").insert({
      provider_id: providerId,
      vehicle_id: input.vehicle_id,
      branch_id: branch.id,
      currency: branch.currency,
      base_daily_minor: majorToMinor(input.daily_price, branch.currency),
    });
    if (error) {
      await supabaseAdmin.from("fleet_units").delete().eq("id", unit.id);
      throw new Error(`units: ${error.message}`);
    }
  }

  return NextResponse.json(unit, { status: 201 });
});
