import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { ProviderStatus } from "@/types/database";

const STATUSES: ProviderStatus[] = ["draft", "submitted", "under_review", "approved", "rejected", "suspended"];

/** GET /api/admin/providers?status= — applications and providers, with counts of what still needs review. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();

  const wanted = request.nextUrl.searchParams.get("status");
  let query = supabaseAdmin
    .from("providers")
    .select("id, type, legal_name, display_name, country_code, default_currency, status, submitted_at, reviewed_at, created_at")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (wanted && (STATUSES as string[]).includes(wanted)) query = query.eq("status", wanted as ProviderStatus);

  const { data: providers, error } = await query;
  if (error) throw new Error(`admin providers: ${error.message}`);

  const ids = (providers ?? []).map((p) => p.id);
  const tally = (rows: { provider_id: string }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) counts.set(row.provider_id, (counts.get(row.provider_id) ?? 0) + 1);
    return counts;
  };

  const [docs, cars] = ids.length
    ? await Promise.all([
        supabaseAdmin.from("provider_documents").select("provider_id").in("provider_id", ids).eq("status", "pending"),
        supabaseAdmin.from("fleet_units").select("provider_id").in("provider_id", ids).eq("listing_status", "pending_review"),
      ])
    : [{ data: [] }, { data: [] }];
  const pendingDocs = tally(docs.data);
  const pendingCars = tally(cars.data);

  return NextResponse.json({
    data: (providers ?? []).map((p) => ({
      ...p,
      pending_documents: pendingDocs.get(p.id) ?? 0,
      cars_pending_review: pendingCars.get(p.id) ?? 0,
    })),
  });
});
