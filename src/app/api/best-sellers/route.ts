import { NextRequest, NextResponse } from "next/server";
import { getBestSellers } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { BestSellersQuerySchema, searchParamsToObject } from "@/lib/schemas";

/**
 * GET /api/best-sellers?startDate=&endDate=&limit=
 *
 * `startDate`/`endDate` are accepted for symmetry with the other stats
 * endpoints, but `v_best_sellers` has no date column — see the caveat on
 * `getBestSellers` in queries.ts. Results are always all-time.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { startDate, endDate, limit } = BestSellersQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const bestSellers = await getBestSellers(startDate, endDate, limit);
  return NextResponse.json(bestSellers);
});
