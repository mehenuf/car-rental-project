import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";

const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({ body: z.string().trim().min(1).max(1000) });

/** POST /api/provider/reviews/[id]/reply — one public reply to a review of the provider. */
export const POST = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { userId } = await requireProviderAccess("bookings.operate");
  const { id } = ParamsSchema.parse(await context.params);
  const { body } = BodySchema.parse(await request.json());
  const { error } = await supabaseAdmin.rpc("reply_to_review", { p_review_id: id, p_author: userId, p_body: body });
  if (error) throw toTrustError(error, "review");
  return NextResponse.json({ ok: true }, { status: 201 });
});
