import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { canAccessBranch } from "@/lib/provider/permissions";
import { CreateBranchSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/branches — the provider's branches, with the private address (members only). */
export const GET = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("provider.read");

  const [branches, addresses] = await Promise.all([
    supabaseAdmin
      .from("branches")
      .select("id, code, name, city, country, country_code, currency, timezone, turnaround_minutes, pickup_surcharge_minor, is_active")
      .eq("provider_id", providerId)
      .order("id", { ascending: true }),
    supabaseAdmin.from("branch_private").select("branch_id, address").eq("provider_id", providerId),
  ]);
  if (branches.error) throw new Error(`branches: ${branches.error.message}`);

  const byBranch = new Map((addresses.data ?? []).map((a) => [a.branch_id, a.address]));
  return NextResponse.json({
    data: (branches.data ?? [])
      .filter((b) => canAccessBranch(membership, b.id))
      .map((b) => ({ ...b, address: byBranch.get(b.id) ?? null })),
  });
});

/** POST /api/provider/branches — a company adds a branch. A private owner has exactly one pick-up point. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("fleet.write");
  if (membership.provider.type === "individual") {
    throw new ConflictError("A private owner has a single pick-up location.");
  }
  const input = CreateBranchSchema.parse(await request.json());

  const { count } = await supabaseAdmin.from("branches").select("id", { count: "exact", head: true }).eq("provider_id", providerId);
  const country = new Intl.DisplayNames(["en"], { type: "region" }).of(membership.provider.countryCode) ?? membership.provider.countryCode;

  const { data: branch, error } = await supabaseAdmin
    .from("branches")
    .insert({
      provider_id: providerId,
      code: `${membership.provider.countryCode}-${(count ?? 0) + 1}`,
      name: input.name,
      city: input.city,
      country,
      country_code: membership.provider.countryCode,
      currency: membership.provider.defaultCurrency,
      timezone: input.timezone,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new ConflictError("A branch with this code already exists. Try again.");
    throw new Error(`branches: ${error.message}`);
  }

  const { error: addressError } = await supabaseAdmin
    .from("branch_private")
    .insert({ branch_id: branch.id, provider_id: providerId, address: input.address });
  if (addressError) {
    await supabaseAdmin.from("branches").delete().eq("id", branch.id);
    throw new Error(`branches: ${addressError.message}`);
  }
  return NextResponse.json({ id: branch.id }, { status: 201 });
});
