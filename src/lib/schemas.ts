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

export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(value)), "must be a valid date");

// ---------------------------------------------------------------
// GET /api/vehicles
// ---------------------------------------------------------------

/** Accepts a single category or a comma-separated list, e.g. "popular,large". */
const CategoryListSchema = z
  .string()
  .transform((value) => value.split(",").map((v) => v.trim()).filter(Boolean))
  .pipe(z.array(VehicleCategorySchema).min(1));

export const VehiclesQuerySchema = z
  .object({
    category: CategoryListSchema.optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    seats: z.coerce.number().int().positive().optional(),
    transmission: TransmissionSchema.optional(),
    fuel: FuelSchema.optional(),
    available: QueryBooleanSchema.optional(),
    locationId: z.coerce.number().int().positive().optional(),
    sortBy: VehicleSortBySchema.optional(),
    sortOrder: SortOrderSchema.optional(),
    page: PageSchema.optional(),
    pageSize: PageSizeSchema.optional(),
    /** Case-insensitive match against name, brand, or slug. */
    search: z.string().trim().min(1).optional(),
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
// POST / PATCH / DELETE /api/vehicles
//
// PATCH and DELETE operate on the collection route (not a `/[id]` segment)
// with the target `id` in the body — `/api/vehicles/[slug]` already owns
// that dynamic segment for the public GET-by-slug lookup, and Next.js
// doesn't allow two differently-named dynamic params at the same route
// position (`[slug]` and `[id]` siblings). Admin-only, so this is fine.
// ---------------------------------------------------------------

const VehicleFieldsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
  name: z.string().trim().min(1, "name is required"),
  brand: z.string().trim().min(1, "brand is required"),
  category: VehicleCategorySchema,
  price_per_day: z.coerce.number().positive(),
  seats: z.coerce.number().int().positive(),
  doors: z.coerce.number().int().positive(),
  transmission: TransmissionSchema,
  fuel: FuelSchema,
  image_url: z.url("image_url must be a valid URL"),
  gallery: z.array(z.url()),
  description: z.string().nullable(),
  features: z.array(z.string()),
  rating: z.coerce.number().min(0).max(5),
  review_count: z.coerce.number().int().nonnegative(),
  stock: z.coerce.number().int().nonnegative(),
  available: z.boolean(),
  location_id: z.coerce.number().int().nullable(),
});

export const CreateVehicleSchema = VehicleFieldsSchema.partial({
  seats: true,
  doors: true,
  gallery: true,
  description: true,
  features: true,
  rating: true,
  review_count: true,
  stock: true,
  available: true,
  location_id: true,
});

export const UpdateVehicleSchema = VehicleFieldsSchema.partial().extend({
  id: z.uuid("id must be a valid UUID"),
});

export const DeleteVehicleSchema = z.object({
  id: z.uuid("id must be a valid UUID"),
});

// ---------------------------------------------------------------
// PATCH /api/bookings/[id] — admin-only status change.
// ---------------------------------------------------------------

export const BookingIdParamSchema = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export const UpdateBookingStatusSchema = z.object({
  status: BookingStatusSchema,
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
  /** Filters on `created_at`, inclusive. */
  startDate: DateOnlySchema.optional(),
  endDate: DateOnlySchema.optional(),
  /** Matches customer_name or reference, case-insensitive. */
  search: z.string().trim().min(1).optional(),
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

// ---------------------------------------------------------------
// GET /api/best-sellers
// ---------------------------------------------------------------

export const BestSellersQuerySchema = z.object({
  startDate: DateOnlySchema.optional(),
  endDate: DateOnlySchema.optional(),
  limit: z.coerce.number().int().positive().max(20).optional(),
});

// ---------------------------------------------------------------
// GET /api/monthly-sales
// ---------------------------------------------------------------

export const MonthlySalesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

// ---------------------------------------------------------------
// GET /api/sales-by-country
// ---------------------------------------------------------------

export const SalesByCountryQuerySchema = z.object({
  startDate: DateOnlySchema.optional(),
  endDate: DateOnlySchema.optional(),
});
