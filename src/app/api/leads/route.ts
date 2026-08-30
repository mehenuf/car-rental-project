import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { LeadsQuerySchema, searchParamsToObject } from "@/lib/schemas";

/** GET /api/leads?page=&pageSize= (sorted by score, highest first) — admin-only. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const query = LeadsQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
  const result = await getLeads(query);
  return NextResponse.json(result);
});
