import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { RespondDisputeSchema } from "@/lib/disputes/rules";
import { respondToDispute } from "@/lib/disputes/server";
import { dispatchSoon } from "@/lib/comms/service";

const ParamsSchema = z.object({ id: z.string().uuid() });

/** POST /api/provider/disputes/[id] — the provider adds a message or evidence, or accepts, counters or contests an offer. */
export const POST = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { userId } = await requireProviderAccess("bookings.operate");
  const { id } = ParamsSchema.parse(await context.params);
  const input = RespondDisputeSchema.parse(await request.json());
  const dispute = await respondToDispute(id, "provider", userId, input);
  dispatchSoon();
  return NextResponse.json({ status: dispute.status });
});
