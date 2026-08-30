import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { searchParamsToObject, StatsQuerySchema } from "@/lib/schemas";

/** GET /api/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — admin-only. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const { startDate, endDate } = StatsQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const stats = await getDashboardStats(startDate, endDate);
  return NextResponse.json(stats);
});
