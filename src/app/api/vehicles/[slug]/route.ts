import { NextRequest, NextResponse } from "next/server";
import { getVehicleBySlug } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { VehicleSlugParamSchema } from "@/lib/schemas";

/** GET /api/vehicles/[slug] */
export const GET = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = VehicleSlugParamSchema.parse(await context.params);

    const vehicle = await getVehicleBySlug(slug);
    if (!vehicle) {
      throw new NotFoundError(`Vehicle "${slug}" not found`);
    }

    return NextResponse.json(vehicle);
  }
);
