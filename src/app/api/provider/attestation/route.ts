import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { INSURANCE_DECLARATION_VERSION } from "@/lib/provider/attestation";
import { supabaseAdmin } from "@/lib/supabase-server";

const BodySchema = z.object({ accepted: z.literal(true) });

/** GET /api/provider/attestation — whether the current insurance declaration has been accepted. */
export const GET = withErrorHandling(async () => {
  const { providerId } = await requireProviderAccess("provider.read");
  const { data } = await supabaseAdmin.from("insurance_attestations").select("accepted_at").eq("provider_id", providerId).eq("version", INSURANCE_DECLARATION_VERSION).maybeSingle();
  return NextResponse.json({ version: INSURANCE_DECLARATION_VERSION, acceptedAt: data?.accepted_at ?? null });
});

/** POST /api/provider/attestation — records that the owner accepted the versioned insurance declaration. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, userId } = await requireProviderAccess("fleet.write");
  BodySchema.parse(await request.json());
  const { error } = await supabaseAdmin
    .from("insurance_attestations")
    .upsert({ provider_id: providerId, version: INSURANCE_DECLARATION_VERSION, accepted_by: userId }, { onConflict: "provider_id,version", ignoreDuplicates: true });
  if (error) throw new Error(`attestation: ${error.message}`);
  return NextResponse.json({ ok: true }, { status: 201 });
});
