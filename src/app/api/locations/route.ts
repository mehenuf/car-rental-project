import { NextResponse } from "next/server";
import { getLocations } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";

/** GET /api/locations — powers the pick-up/drop-off location dropdowns. No input to validate. */
export const GET = withErrorHandling(async () => {
  const locations = await getLocations();
  return NextResponse.json(locations);
});
