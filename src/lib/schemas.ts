import { z } from "zod";
import type { SortOrder, TransactionSortBy, VehicleSortBy } from "@/lib/queries";
import type {
  BookingSource,
  BookingStatus,
  Fuel,
  PaymentMethod,
  Transmission,
  VehicleCategory,
} from "@/types/database";

/** Turns `URLSearchParams` into a plain object so Zod can `.parse()` it —
 * absent keys are simply missing, which plays correctly with `.optional()`. */
export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    obj[key] = value;
  }
  return obj;
}

// ---------------------------------------------------------------
// Enum schemas (kept in sync with schema.sql check constraints via the
// `satisfies` checks against the canonical unions in types/database.ts)
// ---------------------------------------------------------------

const vehicleCategoryValues = [
  "popular",
  "large",
  "small",
  "exclusive",
] as const satisfies readonly VehicleCategory[];
export const VehicleCategorySchema = z.enum(vehicleCategoryValues);

const transmissionValues = ["automatic", "manual"] as const satisfies readonly Transmission[];
export const TransmissionSchema = z.enum(transmissionValues);

const fuelValues = [
  "petrol",
  "diesel",
  "hybrid",
  "electric",
] as const satisfies readonly Fuel[];
export const FuelSchema = z.enum(fuelValues);

const bookingStatusValues = [
  "success",
  "pending",
  "cancelled",
] as const satisfies readonly BookingStatus[];
export const BookingStatusSchema = z.enum(bookingStatusValues);

const paymentMethodValues = [
  "paypal",
  "stripe",
  "apple_pay",
  "payu",
  "paytm",
] as const satisfies readonly PaymentMethod[];
export const PaymentMethodSchema = z.enum(paymentMethodValues);

const bookingSourceValues = ["web", "chat", "phone"] as const satisfies readonly BookingSource[];
export const BookingSourceSchema = z.enum(bookingSourceValues);

const vehicleSortByValues = [
  "price_per_day",
  "rating",
  "created_at",
  "name",
] as const satisfies readonly VehicleSortBy[];
export const VehicleSortBySchema = z.enum(vehicleSortByValues);

const transactionSortByValues = [
  "created_at",
  "total_amount",
  "pickup_at",
] as const satisfies readonly TransactionSortBy[];
export const TransactionSortBySchema = z.enum(transactionSortByValues);

const sortOrderValues = ["asc", "desc"] as const satisfies readonly SortOrder[];
export const SortOrderSchema = z.enum(sortOrderValues);

// A plain boolean query param arrives as the literal string "true"/"false" —
// z.coerce.boolean() would treat any non-empty string (including "false") as true.
const QueryBooleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const PageSchema = z.coerce.number().int().positive();
const PageSizeSchema = z.coerce.number().int().positive().max(100);

// ---------------------------------------------------------------
// GET /api/vehicles
// ---------------------------------------------------------------

export const VehiclesQuerySchema = z
  .object({
    category: VehicleCategorySchema.optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    seats: z.coerce.number().int().positive().optional(),
    transmission: TransmissionSchema.optional(),
    fuel: FuelSchema.optional(),
    available: QueryBooleanSchema.optional(),
    sortBy: VehicleSortBySchema.optional(),
    sortOrder: SortOrderSchema.optional(),
    page: PageSchema.optional(),
    pageSize: PageSizeSchema.optional(),
  })
  .refine(
    (data) =>
      data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice,
    { message: "minPrice must be less than or equal to maxPrice", path: ["minPrice"] }
  );

// ---------------------------------------------------------------
// GET /api/vehicles/[slug]
// ---------------------------------------------------------------

export const VehicleSlugParamSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

// ---------------------------------------------------------------
// GET /api/bookings
// ---------------------------------------------------------------

export const BookingsQuerySchema = z.object({
  status: BookingStatusSchema.optional(),
  sortBy: TransactionSortBySchema.optional(),
  sortOrder: SortOrderSchema.optional(),
  page: PageSchema.optional(),
  pageSize: PageSizeSchema.optional(),
});

// ---------------------------------------------------------------
// POST /api/bookings
//
// `status` and `lead_score` are deliberately NOT accepted from the client —
// they're server/AI-controlled (a client shouldn't be able to mark its own
// booking "success" or set its own lead score). New bookings always start
// at the DB default (`pending`) with a null lead_score.
// ---------------------------------------------------------------

export const CreateBookingSchema = z
  .object({
    vehicle_id: z.string().uuid("vehicle_id must be a valid UUID"),
    customer_name: z.string().trim().min(1, "customer_name is required"),
    email: z.string().trim().email("email must be a valid email address"),
    phone: z.string().trim().min(1).nullable().optional(),
    pickup_location_id: z.coerce.number().int().nullable().optional(),
    dropoff_location_id: z.coerce.number().int().nullable().optional(),
    pickup_at: z.coerce.date({ message: "pickup_at must be a valid date" }),
    dropoff_at: z.coerce.date({ message: "dropoff_at must be a valid date" }),
    payment_method: PaymentMethodSchema.nullable().optional(),
    source: BookingSourceSchema.optional(),
  })
  .refine((data) => data.dropoff_at.getTime() > data.pickup_at.getTime(), {
    message: "dropoff_at must be after pickup_at",
    path: ["dropoff_at"],
  });

// ---------------------------------------------------------------
// GET /api/stats
// ---------------------------------------------------------------

const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(value)), "must be a valid date");

export const StatsQuerySchema = z
  .object({
    startDate: DateOnlySchema,
    endDate: DateOnlySchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
    path: ["startDate"],
  });

// ---------------------------------------------------------------
// GET /api/leads
// ---------------------------------------------------------------

export const LeadsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});
