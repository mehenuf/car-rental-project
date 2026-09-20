import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { majorToMinor } from "@/lib/pricing/money";
import { requireProviderAccess } from "@/lib/provider/context";
import { dateRangeInclusive } from "@/lib/provider/pricing-forms";
import { IdParamSchema, SeasonSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** POST /api/provider/rate-plans/[id]/seasons — a price for a stretch of dates that replaces the base price on those days. */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId } = await requireProviderAccess("pricing.write");
    const { id } = IdParamSchema.parse(await context.params);
    const input = SeasonSchema.parse(await request.json());

    const { data: plan, error } = await supabaseAdmin
      .from("rate_plans")
      .select("id, currency")
      .eq("id", id)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (error) throw new Error(`season: ${error.message}`);
    if (!plan) throw new NotFoundError("Price not found.");

    const { data, error: insertError } = await supabaseAdmin
      .from("rate_seasons")
      .insert({
        rate_plan_id: plan.id,
        provider_id: providerId,
        during: dateRangeInclusive(input.start_date, input.end_date),
        daily_minor: majorToMinor(input.daily, plan.currency),
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23P01") throw new ConflictError("This overlaps another season for the same car.");
      throw new Error(`season: ${insertError.message}`);
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  }
);
