import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { IdParamSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** DELETE /api/provider/seasons/[id] — removes a season. Existing bookings keep the price they were quoted. */
export const DELETE = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId } = await requireProviderAccess("pricing.write");
    const { id } = IdParamSchema.parse(await context.params);
    const { data, error } = await supabaseAdmin.from("rate_seasons").delete().eq("id", id).eq("provider_id", providerId).select("id");
    if (error) throw new Error(`season: ${error.message}`);
    if (!data || data.length === 0) throw new NotFoundError("Season not found.");
    return NextResponse.json({ ok: true });
  }
);
