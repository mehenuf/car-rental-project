import { NextRequest, NextResponse } from "next/server";
import { createVehicle, deleteVehicle, getVehicles, updateVehicle } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import {
  CreateVehicleSchema,
  DeleteVehicleSchema,
  UpdateVehicleSchema,
  VehiclesQuerySchema,
  searchParamsToObject,
} from "@/lib/schemas";

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

/** POST /api/vehicles — admin-only create. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const body = await request.json();
  const input = CreateVehicleSchema.parse(body);
  const vehicle = await createVehicle(input);
  return NextResponse.json(vehicle, { status: 201 });
});

/**
 * PATCH /api/vehicles — admin-only update. Target `id` is in the body
 * rather than the URL; see the note on `UpdateVehicleSchema` for why.
 */
export const PATCH = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const body = await request.json();
  const { id, ...fields } = UpdateVehicleSchema.parse(body);
  const vehicle = await updateVehicle(id, fields);
  return NextResponse.json(vehicle);
});

/** DELETE /api/vehicles — admin-only delete, target `id` in the body. */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const body = await request.json();
  const { id } = DeleteVehicleSchema.parse(body);
  await deleteVehicle(id);
  return NextResponse.json({ success: true });
});
