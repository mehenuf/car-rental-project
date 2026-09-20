import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { ProfileSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/profile — the provider's public name and contact details. */
export const GET = withErrorHandling(async () => {
  const { providerId } = await requireProviderAccess("provider.read");
  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("id, type, legal_name, display_name, country_code, default_currency, contact_phone, registration_number, status")
    .eq("id", providerId)
    .single();
  if (error) throw new Error(`profile: ${error.message}`);
  return NextResponse.json({ data });
});

/** PATCH /api/provider/profile — change the name customers see or the contact phone. The legal name and currency change only through support. */
export const PATCH = withErrorHandling(async (request: NextRequest) => {
  const { providerId } = await requireProviderAccess("documents.write");
  const input = ProfileSchema.parse(await request.json());
  const { data, error } = await supabaseAdmin
    .from("providers")
    .update(input)
    .eq("id", providerId)
    .select("display_name, contact_phone")
    .single();
  if (error) throw new Error(`profile: ${error.message}`);
  return NextResponse.json({ data });
});
