import { NextRequest } from "next/server";
import { csvStream } from "@/lib/admin/csv";
import { EXPORTS, parseRange } from "@/lib/admin/exports";
import { requireStaff, writeAudit } from "@/lib/admin/staff";
import { handleApiError } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

const PAGE = 1000;

/**
 * GET /api/admin/exports/[kind]?from=YYYY-MM-DD&to=YYYY-MM-DD — a streamed CSV. Permission-checked per export,
 * limited to a year, and audited with the range asked for. Spreadsheet formulas in cells are defused.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await context.params;
    const spec = EXPORTS[kind];
    if (!spec) throw new ApiError(404, "Unknown export.");
    const ctx = await requireStaff(spec.permission);

    const range = parseRange(request.nextUrl.searchParams.get("from"), request.nextUrl.searchParams.get("to"), spec.dateColumn !== "");
    if ("error" in range) throw new ApiError(400, range.error);

    const s = spec;
    const rangeFrom = range.from;
    const rangeTo = range.to;
    await writeAudit(ctx, { action: "export.run", entityType: "export", entityId: kind, after: { from: range.from, to: range.to } });

    async function* rows() {
      for (let offset = 0; ; offset += PAGE) {
        // The table name comes from the fixed catalogue above, never from the request.
        let query = supabaseAdmin.from(s.table as "bookings").select(s.columns.join(",")).order(s.orderBy).range(offset, offset + PAGE - 1);
        if (s.dateColumn && rangeFrom && rangeTo) query = query.gte(s.dateColumn, rangeFrom).lte(s.dateColumn, rangeTo);
        if (s.filter) query = query.eq(s.filter.column, s.filter.value);
        const { data, error } = await query;
        if (error) throw new Error(`export ${kind}: ${error.message}`);
        const page = (data ?? []) as unknown as Record<string, unknown>[];
        for (const row of page) yield row;
        if (page.length < PAGE) return;
      }
    }

    const encoder = new TextEncoder();
    const iterator = csvStream(rows(), s.columns);
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bestcar-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
