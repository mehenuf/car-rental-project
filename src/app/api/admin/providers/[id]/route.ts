import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { IdParamSchema } from "@/lib/provider/schemas";
import { requireAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/admin/providers/[id] — one application with its documents, branches and cars. */
export const GET = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = IdParamSchema.parse(await context.params);

    const { data: provider, error } = await supabaseAdmin.from("providers").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`admin provider: ${error.message}`);
    if (!provider) throw new NotFoundError("Provider not found.");

    const [documents, branches, units] = await Promise.all([
      supabaseAdmin
        .from("provider_documents")
        .select("id, fleet_unit_id, kind, file_name, mime_type, size_bytes, status, review_note, created_at")
        .eq("provider_id", id)
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("branches").select("id, code, name, city, country, currency, is_active").eq("provider_id", id),
      supabaseAdmin
        .from("fleet_units")
        .select("id, plate, listing_status, review_note, status, vehicle_id")
        .eq("provider_id", id),
    ]);
    for (const result of [documents, branches, units]) {
      if (result.error) throw new Error(`admin provider: ${result.error.message}`);
    }

    // Vehicle names for the cars, in one query.
    const vehicleIds = [...new Set((units.data ?? []).map((u) => u.vehicle_id))];
    const { data: vehicles } = vehicleIds.length
      ? await supabaseAdmin.from("vehicles").select("id, name").in("id", vehicleIds)
      : { data: [] };
    const names = new Map((vehicles ?? []).map((v) => [v.id, v.name]));

    return NextResponse.json({
      provider,
      documents: documents.data ?? [],
      branches: branches.data ?? [],
      cars: (units.data ?? []).map((u) => ({ ...u, vehicle_name: names.get(u.vehicle_id) ?? "Unknown model" })),
    });
  }
);
