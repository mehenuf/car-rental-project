import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError } from "@/lib/errors";
import { majorToMinor, minorToMajor } from "@/lib/pricing/money";
import { requireProviderAccess } from "@/lib/provider/context";
import { ExtraSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/extras — add-ons and insurance the provider offers, in the units a person types. */
export const GET = withErrorHandling(async () => {
  const { providerId } = await requireProviderAccess("pricing.write");
  const { data, error } = await supabaseAdmin.from("extras").select("*").eq("provider_id", providerId).order("code", { ascending: true });
  if (error) throw new Error(`extras: ${error.message}`);
  return NextResponse.json({
    data: (data ?? []).map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      kind: e.kind,
      pricing: e.pricing,
      currency: e.currency,
      unit_price: minorToMajor(e.unit_price_minor, e.currency),
      max_quantity: e.max_quantity,
      cap: e.cap_minor === null ? null : minorToMajor(e.cap_minor, e.currency),
      is_mandatory: e.is_mandatory,
      is_active: e.is_active,
    })),
  });
});

/** POST /api/provider/extras — adds an extra. Its price is in the provider's currency. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("pricing.write");
  const input = ExtraSchema.parse(await request.json());
  const currency = membership.provider.defaultCurrency;

  const { data, error } = await supabaseAdmin
    .from("extras")
    .insert({
      provider_id: providerId,
      code: input.code,
      name: input.name,
      kind: input.kind,
      pricing: input.pricing,
      unit_price_minor: majorToMinor(input.unit_price, currency),
      currency,
      max_quantity: input.max_quantity,
      cap_minor: input.cap == null ? null : majorToMinor(input.cap, currency),
      is_mandatory: input.is_mandatory,
      is_active: input.is_active,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new ConflictError("You already have an extra with this code.");
    throw new Error(`extras: ${error.message}`);
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
});
