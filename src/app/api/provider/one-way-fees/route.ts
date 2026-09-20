import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { majorToMinor, minorToMajor } from "@/lib/pricing/money";
import { requireProviderAccess } from "@/lib/provider/context";
import { OneWayFeeSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/one-way-fees — what a customer pays to drop a car at a different branch. */
export const GET = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const { data, error } = await supabaseAdmin
    .from("one_way_fees")
    .select("from_branch_id, to_branch_id, amount_minor")
    .eq("provider_id", providerId);
  if (error) throw new Error(`one-way fees: ${error.message}`);
  const currency = membership.provider.defaultCurrency;
  return NextResponse.json({
    data: (data ?? []).map((f) => ({ from_branch_id: f.from_branch_id, to_branch_id: f.to_branch_id, amount: minorToMajor(f.amount_minor, currency) })),
  });
});

async function assertOwnBranches(providerId: string, ids: number[]): Promise<void> {
  const { data, error } = await supabaseAdmin.from("branches").select("id").eq("provider_id", providerId).in("id", ids);
  if (error) throw new Error(`one-way fees: ${error.message}`);
  if ((data ?? []).length !== new Set(ids).size) throw new ApiError(400, "Both branches must be yours.");
}

/** PUT /api/provider/one-way-fees — sets the fee for one direction between two of your branches. */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const input = OneWayFeeSchema.parse(await request.json());
  if (input.from_branch_id === input.to_branch_id) throw new ApiError(400, "Choose two different branches.");
  await assertOwnBranches(providerId, [input.from_branch_id, input.to_branch_id]);

  const { error } = await supabaseAdmin.from("one_way_fees").upsert({
    provider_id: providerId,
    from_branch_id: input.from_branch_id,
    to_branch_id: input.to_branch_id,
    amount_minor: majorToMinor(input.amount, membership.provider.defaultCurrency),
  });
  if (error) throw new Error(`one-way fees: ${error.message}`);
  return NextResponse.json({ ok: true });
});

/** DELETE /api/provider/one-way-fees?from=1&to=2 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const { providerId } = await requireProviderAccess("pricing.write");
  const from = Number(request.nextUrl.searchParams.get("from"));
  const to = Number(request.nextUrl.searchParams.get("to"));
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new ApiError(400, "from and to are required.");
  const { error } = await supabaseAdmin.from("one_way_fees").delete().eq("provider_id", providerId).eq("from_branch_id", from).eq("to_branch_id", to);
  if (error) throw new Error(`one-way fees: ${error.message}`);
  return NextResponse.json({ ok: true });
});
