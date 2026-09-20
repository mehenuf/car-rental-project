import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { IdParamSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * DELETE /api/provider/availability/[kind]/[id] — removes a window or a block.
 * Booking occupancy cannot be deleted here (cancel the booking instead), and a
 * window cannot be removed if a booking sits inside it.
 */
export const DELETE = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ kind: string; id: string }> }) => {
    const { providerId } = await requireProviderAccess("availability.write");
    const params = await context.params;
    const { id } = IdParamSchema.parse({ id: params.id });

    if (params.kind === "window") {
      const { data, error } = await supabaseAdmin
        .from("availability_windows")
        .delete()
        .eq("id", id)
        .eq("provider_id", providerId)
        .select("id");
      if (error) throw new Error(`availability: ${error.message}`);
      if (!data || data.length === 0) throw new NotFoundError("Window not found.");
      return NextResponse.json({ ok: true });
    }

    if (params.kind === "block") {
      const { data, error } = await supabaseAdmin
        .from("unit_occupancy")
        .delete()
        .eq("id", id)
        .eq("provider_id", providerId)
        .in("reason", ["maintenance", "owner_block"]) // never a booking's occupancy
        .select("id");
      if (error) throw new Error(`availability: ${error.message}`);
      if (!data || data.length === 0) throw new NotFoundError("Block not found.");
      return NextResponse.json({ ok: true });
    }

    throw new ApiError(400, "Unknown kind.");
  }
);
