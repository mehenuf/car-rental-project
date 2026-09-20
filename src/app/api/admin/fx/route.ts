import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

const RateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: z.string().length(3).transform((v) => v.toUpperCase()),
  quote: z.string().length(3).transform((v) => v.toUpperCase()),
  rate: z.number().positive().max(1_000_000),
});

/** POST /api/admin/fx — adds or updates a manual exchange rate. Used only for the labelled approximate totals in reports. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const ctx = await requireStaff("fees.manage");
  const input = RateSchema.parse(await request.json());
  const { error } = await supabaseAdmin.from("fx_rates").upsert({ ...input, source: "manual" }, { onConflict: "date,base,quote" });
  if (error) throw new Error(`fx: ${error.message}`);
  await writeAudit(ctx, { action: "fx.set", entityType: "fx_rate", entityId: `${input.date}:${input.base}:${input.quote}`, after: input });
  return NextResponse.json({ ok: true }, { status: 201 });
});
