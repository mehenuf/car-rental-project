import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { LeadsQuerySchema, searchParamsToObject } from "@/lib/schemas";

/** GET /api/leads?limit= (sorted by score, highest first) */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { limit } = LeadsQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const leads = await getLeads(limit);
  return NextResponse.json(leads);
});
