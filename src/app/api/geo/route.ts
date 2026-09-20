import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo — a hint about where the visitor is, from the hosting platform's edge headers (no permission prompt,
 * no third party). Both values can be missing, for example on a local machine. Used only to pre-select a city.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const country = request.headers.get("x-vercel-ip-country");
  const rawCity = request.headers.get("x-vercel-ip-city");
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      city = rawCity;
    }
  }
  return NextResponse.json({ country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null, city }, { headers: { "Cache-Control": "private, no-store" } });
});
