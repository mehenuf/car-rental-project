import { NextRequest, NextResponse } from "next/server";
import { getVehicles } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { searchParamsToObject, VehiclesQuerySchema } from "@/lib/schemas";

/**
 * GET /api/vehicles?category=&minPrice=&maxPrice=&seats=&transmission=&fuel=
 *                   &available=&sortBy=&sortOrder=&page=&pageSize=
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const query = VehiclesQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const result = await getVehicles(query);
  return NextResponse.json(result);
});
