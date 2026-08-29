import { NextRequest, NextResponse } from "next/server";
import { getMonthlySales } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { MonthlySalesQuerySchema, searchParamsToObject } from "@/lib/schemas";

/** GET /api/monthly-sales?year=YYYY — 12 months of revenue, 0-filled for months with no data. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { year } = MonthlySalesQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const monthlySales = await getMonthlySales(year);
  return NextResponse.json(monthlySales);
});
