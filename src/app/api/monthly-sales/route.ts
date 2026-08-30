import { NextRequest, NextResponse } from "next/server";
import { getMonthlySales } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { MonthlySalesQuerySchema, searchParamsToObject } from "@/lib/schemas";

/** GET /api/monthly-sales?year=YYYY — 12 months of revenue, 0-filled for months with no data. Admin-only. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const { year } = MonthlySalesQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const monthlySales = await getMonthlySales(year);
  return NextResponse.json(monthlySales);
});
