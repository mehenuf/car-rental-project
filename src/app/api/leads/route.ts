import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { LeadsQuerySchema, searchParamsToObject } from "@/lib/schemas";

/** GET /api/leads?page=&pageSize= (sorted by score, highest first) */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const query = LeadsQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
  const result = await getLeads(query);
  return NextResponse.json(result);
});
