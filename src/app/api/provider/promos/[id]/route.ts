import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { IdParamSchema, PromoUpdateSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** PATCH /api/provider/promos/[id] — switch a code on or off. */
export const PATCH = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId } = await requireProviderAccess("pricing.write");
    const { id } = IdParamSchema.parse(await context.params);
    const { is_active } = PromoUpdateSchema.parse(await request.json());
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .update({ is_active })
      .eq("id", id)
      .eq("provider_id", providerId)
      .eq("issuer", "provider")
      .select("id");
    if (error) throw new Error(`promos: ${error.message}`);
    if (!data || data.length === 0) throw new NotFoundError("Promo code not found.");
    return NextResponse.json({ ok: true });
  }
);

/** DELETE /api/provider/promos/[id] */
export const DELETE = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId } = await requireProviderAccess("pricing.write");
    const { id } = IdParamSchema.parse(await context.params);
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .delete()
      .eq("id", id)
      .eq("provider_id", providerId)
      .eq("issuer", "provider")
      .select("id");
    if (error) throw new Error(`promos: ${error.message}`);
    if (!data || data.length === 0) throw new NotFoundError("Promo code not found.");
    return NextResponse.json({ ok: true });
  }
);
