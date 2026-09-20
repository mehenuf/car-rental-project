import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/admin/licences — driver's licences waiting for review, oldest first, with their files listed. */
export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const { data: profiles, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("user_id, date_of_birth, licence_country, licence_number_last4, licence_expiry, submitted_at")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`licences: ${error.message}`);

  const ids = (profiles ?? []).map((p) => p.user_id);
  const { data: documents, error: docError } = ids.length
    ? await supabaseAdmin.from("driver_documents").select("id, user_id, kind").in("user_id", ids)
    : { data: [], error: null };
  if (docError) throw new Error(`licences: ${docError.message}`);

  return NextResponse.json({
    data: (profiles ?? []).map((p) => ({
      ...p,
      documents: (documents ?? []).filter((d) => d.user_id === p.user_id).map((d) => ({ id: d.id, kind: d.kind })),
    })),
  });
});
