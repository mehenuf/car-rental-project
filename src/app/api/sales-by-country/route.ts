import { NextRequest, NextResponse } from "next/server";
import { getSalesByCountry } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { SalesByCountryQuerySchema, searchParamsToObject } from "@/lib/schemas";

/**
 * GET /api/sales-by-country?startDate=&endDate= — admin-only.
 *
 * `startDate`/`endDate` are accepted for symmetry with the other stats
 * endpoints, but `v_sales_by_country` has no date column — see the caveat
 * on `getSalesByCountry` in queries.ts. Results are always all-time.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const { startDate, endDate } = SalesByCountryQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const salesByCountry = await getSalesByCountry(startDate, endDate);
  return NextResponse.json(salesByCountry);
});
