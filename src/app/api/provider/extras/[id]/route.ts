import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { majorToMinor } from "@/lib/pricing/money";
import { requireProviderAccess } from "@/lib/provider/context";
import { ExtraUpdateSchema, IdParamSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** PATCH /api/provider/extras/[id] — change an extra. Bookings already made keep the price they were quoted. */
export const PATCH = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership } = await requireProviderAccess("pricing.write");
    const { id } = IdParamSchema.parse(await context.params);
    const input = ExtraUpdateSchema.parse(await request.json());
    const currency = membership.provider.defaultCurrency;

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.kind !== undefined) update.kind = input.kind;
    if (input.pricing !== undefined) update.pricing = input.pricing;
    if (input.unit_price !== undefined) update.unit_price_minor = majorToMinor(input.unit_price, currency);
    if (input.max_quantity !== undefined) update.max_quantity = input.max_quantity;
    if (input.cap !== undefined) update.cap_minor = input.cap === null ? null : majorToMinor(input.cap, currency);
    if (input.is_mandatory !== undefined) update.is_mandatory = input.is_mandatory;
    if (input.is_active !== undefined) update.is_active = input.is_active;

    const { data, error } = await supabaseAdmin.from("extras").update(update as never).eq("id", id).eq("provider_id", providerId).select("id");
    if (error) throw new Error(`extras: ${error.message}`);
    if (!data || data.length === 0) throw new NotFoundError("Extra not found.");
    return NextResponse.json({ ok: true });
  }
);

/** DELETE /api/provider/extras/[id] */
export const DELETE = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId } = await requireProviderAccess("pricing.write");
    const { id } = IdParamSchema.parse(await context.params);
    const { data, error } = await supabaseAdmin.from("extras").delete().eq("id", id).eq("provider_id", providerId).select("id");
    if (error) throw new Error(`extras: ${error.message}`);
    if (!data || data.length === 0) throw new NotFoundError("Extra not found.");
    return NextResponse.json({ ok: true });
  }
);
