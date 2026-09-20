import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { toBookingApiError } from "@/lib/booking-errors";
import { daysBetween } from "@/lib/date-range";
import type {
  BookingSource,
  BookingStatus,
  Fuel,
  PaymentMethod,
  Tables,
  TablesInsert,
  TablesUpdate,
  Transmission,
  VehicleCategory,
  Views,
} from "@/types/database";

// ---------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}

export interface Pagination {
  page?: number; // 1-based
  pageSize?: number;
}

function toRange({ page = 1, pageSize = 20 }: Pagination): [number, number] {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  return [from, to];
}

/** Returns the immediately preceding period of the same length as [start, end]. */
function previousPeriod(startDate: string, endDate: string): { start: string; end: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const lengthMs = end.getTime() - start.getTime();

  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);

  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  };
}

/** Escapes every character PostgREST's filter-string grammar treats as
 * structural (`,` separates `.or()` clauses, `(`/`)` are grouping syntax,
 * `%`/`_` are ILIKE wildcards) so a search value can never inject
 * additional filter clauses — e.g. a value like `x,stock.eq.0`. */
function escapePostgrestValue(value: string): string {
  return value.replace(/[%_,()]/g, (c) => `\\${c}`);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null; // undefined/infinite change — no baseline to compare to
  }
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------
// getVehicles
// ---------------------------------------------------------------

export type VehicleSortBy = "price_per_day" | "rating" | "created_at" | "name";
export type SortOrder = "asc" | "desc";

export interface VehicleFilters extends Pagination {
  /** One or more categories — matches any of them. */
  category?: VehicleCategory[];
  minPrice?: number;
  maxPrice?: number;
  seats?: number;
  transmission?: Transmission;
  fuel?: Fuel;
  available?: boolean;
  locationId?: number;
  /** Only vehicles with a free unit for this trip. */
  availability?: { pickupBranchId: number; dropoffBranchId: number; from: Date; to: Date };
  sortBy?: VehicleSortBy;
  sortOrder?: SortOrder;
  /** Case-insensitive match against name, brand, or slug. */
  search?: string;
}

/** Vehicle ids allowed by the branch/availability filters, or null for "no restriction".
 * Uses the availability RPC when dates are given, otherwise units at the branch.
 * (An `in` list is fine at current catalogue size; move this into SQL if the
 * catalogue grows to thousands of models.) */
async function resolveVehicleIdFilter(filters: VehicleFilters): Promise<string[] | null> {
  const { locationId, availability } = filters;

  if (availability) {
    const { data, error } = await supabaseAdmin.rpc("available_vehicle_ids", {
      p_pickup_branch_id: availability.pickupBranchId,
      p_dropoff_branch_id: availability.dropoffBranchId,
      p_start: availability.from.toISOString(),
      p_end: availability.to.toISOString(),
    });
    if (error) throw new Error(`resolveVehicleIdFilter: ${error.message}`);
    return data ?? [];
  }

  if (locationId !== undefined) {
    const { data, error } = await supabaseAdmin
      .from("fleet_units")
      .select("vehicle_id")
      .eq("branch_id", locationId)
      .eq("status", "active");
    if (error) throw new Error(`resolveVehicleIdFilter: ${error.message}`);
    return [...new Set((data ?? []).map((row) => row.vehicle_id))];
  }

  return null;
}

export async function getVehicles(
  filters: VehicleFilters = {}
): Promise<PaginatedResult<Tables<"vehicles">>> {
  const {
    category,
    minPrice,
    maxPrice,
    seats,
    transmission,
    fuel,
    available,
    sortBy = "created_at",
    sortOrder = "desc",
    search,
  } = filters;

  const [from, to] = toRange(filters);

  let query = supabaseAdmin.from("vehicles").select("*", { count: "exact" });

  if (category && category.length > 0) query = query.in("category", category);
  if (minPrice !== undefined) query = query.gte("price_per_day", minPrice);
  if (maxPrice !== undefined) query = query.lte("price_per_day", maxPrice);
  if (seats !== undefined) query = query.gte("seats", seats);
  if (transmission) query = query.eq("transmission", transmission);
  if (fuel) query = query.eq("fuel", fuel);
  if (available !== undefined) query = query.eq("available", available);
  const idFilter = await resolveVehicleIdFilter(filters);
  if (idFilter) {
    if (idFilter.length === 0) return { data: [], count: 0 };
    query = query.in("id", idFilter);
  }
  if (search) {
    const escaped = escapePostgrestValue(search);
    query = query.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`getVehicles: ${error.message}`);

  return { data: data ?? [], count: count ?? 0 };
}

/** The columns every card-only consumer of the vehicle catalog actually
 * renders (VehicleCard) — the public /cars grid, the homepage deals
 * section, and "similar vehicles" don't need the full row (description,
 * gallery, features, review_count, location_id, ...) that the admin
 * table's edit dialog does. */
export type VehicleCardData = Pick<
  Tables<"vehicles">,
  "id" | "slug" | "name" | "image_url" | "price_per_day" | "available" | "stock"
>;

const VEHICLE_CARD_COLUMNS = "id, slug, name, image_url, price_per_day, available, stock";

export async function getVehicleCards(
  filters: VehicleFilters = {}
): Promise<PaginatedResult<VehicleCardData>> {
  const {
    category,
    minPrice,
    maxPrice,
    seats,
    transmission,
    fuel,
    available,
    sortBy = "created_at",
    sortOrder = "desc",
    search,
  } = filters;

  const [from, to] = toRange(filters);

  let query = supabaseAdmin
    .from("vehicles")
    .select(VEHICLE_CARD_COLUMNS, { count: "exact" });

  if (category && category.length > 0) query = query.in("category", category);
  if (minPrice !== undefined) query = query.gte("price_per_day", minPrice);
  if (maxPrice !== undefined) query = query.lte("price_per_day", maxPrice);
  if (seats !== undefined) query = query.gte("seats", seats);
  if (transmission) query = query.eq("transmission", transmission);
  if (fuel) query = query.eq("fuel", fuel);
  if (available !== undefined) query = query.eq("available", available);
  const idFilter = await resolveVehicleIdFilter(filters);
  if (idFilter) {
    if (idFilter.length === 0) return { data: [], count: 0 };
    query = query.in("id", idFilter);
  }
  if (search) {
    const escaped = escapePostgrestValue(search);
    query = query.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`getVehicleCards: ${error.message}`);

  return { data: (data ?? []) as unknown as VehicleCardData[], count: count ?? 0 };
}

// ---------------------------------------------------------------
// getVehicleBySlug
// ---------------------------------------------------------------

export async function getVehicleBySlug(
  slug: string
): Promise<Tables<"vehicles"> | null> {
  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getVehicleBySlug: ${error.message}`);
  return data ?? null;
}

// ---------------------------------------------------------------
// getDashboardStats
// ---------------------------------------------------------------

export interface DashboardStats {
  totalRevenue: number;
  salesCount: number;
  purchaseCount: number;
  /** Percentage change vs. the previous period of the same length.
   * `null` when the previous period had zero revenue (no baseline). */
  revenueChangePercent: number | null;
}

async function sumDailyStats(
  startDate: string,
  endDate: string
): Promise<{ revenue: number; salesCount: number; purchases: number }> {
  const { data, error } = await supabaseAdmin
    .from("daily_stats")
    .select("revenue, sales_count, purchases")
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw new Error(`getDashboardStats: ${error.message}`);

  const rows = data ?? [];
  return rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + (row.revenue ?? 0),
      salesCount: acc.salesCount + (row.sales_count ?? 0),
      purchases: acc.purchases + (row.purchases ?? 0),
    }),
    { revenue: 0, salesCount: 0, purchases: 0 }
  );
}

export async function getDashboardStats(
  startDate: string,
  endDate: string
): Promise<DashboardStats> {
  const prev = previousPeriod(startDate, endDate);
  const [current, previous] = await Promise.all([
    sumDailyStats(startDate, endDate),
    sumDailyStats(prev.start, prev.end),
  ]);

  return {
    totalRevenue: current.revenue,
    salesCount: current.salesCount,
    purchaseCount: current.purchases,
    revenueChangePercent: percentChange(current.revenue, previous.revenue),
  };
}

// ---------------------------------------------------------------
// getBestSellers
// ---------------------------------------------------------------

/**
 * Reads `v_best_sellers`. `startDate`/`endDate` are accepted for API
 * symmetry with the other stats queries, but the view aggregates over
 * *all* bookings and exposes no date column to filter on — so results
 * are always all-time. Date-scoped best sellers would require changing
 * the view (or querying `bookings` directly) in schema.sql.
 */
export async function getBestSellers(
  startDate?: string,
  endDate?: string,
  limit: number = 5
): Promise<Views<"v_best_sellers">[]> {
  void startDate;
  void endDate;

  const { data, error } = await supabaseAdmin
    .from("v_best_sellers")
    .select("*")
    .order("sales_count", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getBestSellers: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------
// getRecentTransactions
// ---------------------------------------------------------------

export type TransactionSortBy = "created_at" | "total_amount" | "pickup_at";

export interface RecentTransactionsOptions extends Pagination {
  status?: BookingStatus;
  sortBy?: TransactionSortBy;
  sortOrder?: SortOrder;
  /** Filters on `created_at`, inclusive of the whole day. */
  startDate?: string;
  endDate?: string;
  /** Case-insensitive match against `customer_name` or `reference`. */
  search?: string;
}

/** A booking row with just enough of its vehicle joined in for display
 * (thumbnail + name) — e.g. the dashboard's Recent Transactions table. */
export interface BookingWithVehicle extends Tables<"bookings"> {
  vehicle: Pick<Tables<"vehicles">, "name" | "image_url"> | null;
}

export async function getRecentTransactions(
  options: RecentTransactionsOptions = {}
): Promise<PaginatedResult<BookingWithVehicle>> {
  const {
    status,
    sortBy = "created_at",
    sortOrder = "desc",
    startDate,
    endDate,
    search,
  } = options;
  const [from, to] = toRange(options);

  let query = supabaseAdmin
    .from("bookings")
    .select("*, vehicle:vehicles(name, image_url)", { count: "exact" });
  if (status) query = query.eq("status", status);
  if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
  if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
  if (search) {
    const escaped = escapePostgrestValue(search);
    query = query.or(`customer_name.ilike.%${escaped}%,reference.ilike.%${escaped}%`);
  }
  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`getRecentTransactions: ${error.message}`);

  return { data: data ?? [], count: count ?? 0 };
}

// ---------------------------------------------------------------
// getMonthlySales
// ---------------------------------------------------------------

export interface MonthlySales {
  /** 1-12 */
  month: number;
  revenue: number;
}

export async function getMonthlySales(year: number): Promise<MonthlySales[]> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data, error } = await supabaseAdmin
    .from("daily_stats")
    .select("date, revenue")
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw new Error(`getMonthlySales: ${error.message}`);

  const revenueByMonth = new Array<number>(12).fill(0);
  for (const row of data ?? []) {
    const month = new Date(row.date).getUTCMonth(); // 0-11
    revenueByMonth[month] = (revenueByMonth[month] ?? 0) + (row.revenue ?? 0);
  }

  return revenueByMonth.map((revenue, index) => ({ month: index + 1, revenue }));
}

// ---------------------------------------------------------------
// getSalesByCountry
// ---------------------------------------------------------------

/**
 * Reads `v_sales_by_country`. Same caveat as `getBestSellers`: the view
 * has no date column, so `startDate`/`endDate` are accepted for symmetry
 * but results are always all-time.
 */
export async function getSalesByCountry(
  startDate?: string,
  endDate?: string
): Promise<Views<"v_sales_by_country">[]> {
  void startDate;
  void endDate;

  const { data, error } = await supabaseAdmin
    .from("v_sales_by_country")
    .select("*")
    .order("sales_count", { ascending: false });

  if (error) throw new Error(`getSalesByCountry: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------
// createBooking
// ---------------------------------------------------------------

export interface CreateBookingInput {
  vehicle_id: string;
  customer_name: string;
  email: string;
  phone: string | null;
  pickup_branch_id: number | null;
  dropoff_branch_id: number | null;
  guest_id: string | null;
  user_id: string | null;
  pickup_at: string;
  dropoff_at: string;
  payment_method: PaymentMethod | null;
  source?: BookingSource;
}

function generateBookingReference(): string {
  return `BC-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Explicit branch, else the vehicle's home branch, else the branch of its first active unit. */
async function resolvePickupBranchId(
  vehicleId: string,
  requested: number | null,
  homeBranchId: number | null
): Promise<number> {
  if (requested) return requested;
  if (homeBranchId) return homeBranchId;
  const { data, error } = await supabaseAdmin
    .from("fleet_units")
    .select("branch_id")
    .eq("vehicle_id", vehicleId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`createBooking: ${error.message}`);
  if (!data) throw new ConflictError("This vehicle is no longer available for booking.");
  return data.branch_id;
}

export async function createBooking(data: CreateBookingInput): Promise<Tables<"bookings">> {
  const { data: vehicle, error: vehicleError } = await supabaseAdmin
    .from("vehicles")
    .select("price_per_day, location_id")
    .eq("id", data.vehicle_id)
    .maybeSingle();
  if (vehicleError) throw new Error(`createBooking: ${vehicleError.message}`);
  if (!vehicle) throw new NotFoundError(`Vehicle ${data.vehicle_id} not found`);

  const pickupBranchId = await resolvePickupBranchId(
    data.vehicle_id,
    data.pickup_branch_id,
    vehicle.location_id
  );
  const dropoffBranchId = data.dropoff_branch_id ?? pickupBranchId;

  // Pricing engine arrives in sub-project 2; until then: price_per_day x whole days.
  const days = daysBetween(data.pickup_at, data.dropoff_at);
  const totalAmount = Math.round(vehicle.price_per_day * days * 100) / 100;

  const { data: booking, error } = await supabaseAdmin.rpc("create_booking_atomic", {
    p_vehicle_id: data.vehicle_id,
    p_pickup_branch_id: pickupBranchId,
    p_dropoff_branch_id: dropoffBranchId,
    p_pickup_at: data.pickup_at,
    p_dropoff_at: data.dropoff_at,
    p_customer_name: data.customer_name,
    p_email: data.email,
    p_total_amount: totalAmount,
    p_reference: generateBookingReference(),
    p_phone: data.phone,
    p_payment_method: data.payment_method,
    p_source: data.source ?? "web",
    p_guest_id: data.guest_id,
    p_user_id: data.user_id,
  });

  if (error) throw toBookingApiError(error, "createBooking");
  return booking;
}

// ---------------------------------------------------------------
// getBookingByReference — used by the booking-confirmation page so it
// renders real, server-verified data instead of trusting URL query params.
// ---------------------------------------------------------------

export async function getBookingByReference(
  reference: string
): Promise<BookingWithVehicle | null> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*, vehicle:vehicles(name, image_url)")
    .eq("reference", reference)
    .maybeSingle();

  if (error) throw new Error(`getBookingByReference: ${error.message}`);
  return data ?? null;
}

// ---------------------------------------------------------------
// getBookingsForIdentity — "my bookings" for the guest cookie / signed-in
// customer. Powers /dashboard and the booking form's contact pre-fill.
// ---------------------------------------------------------------

export async function getBookingsForIdentity(identity: {
  userId?: string | null;
  guestId?: string | null;
}): Promise<BookingWithVehicle[]> {
  const { userId, guestId } = identity;
  if (!userId && !guestId) return [];

  let query = supabaseAdmin
    .from("bookings")
    .select("*, vehicle:vehicles(name, image_url)")
    .order("created_at", { ascending: false });

  query = userId ? query.eq("user_id", userId) : query.eq("guest_id", guestId!);

  const { data, error } = await query;
  if (error) throw new Error(`getBookingsForIdentity: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------
// getLeads — highest score first.
// ---------------------------------------------------------------

export async function getLeads(
  pagination: Pagination = {}
): Promise<PaginatedResult<Tables<"leads">>> {
  const [from, to] = toRange(pagination);

  const { data, error, count } = await supabaseAdmin
    .from("leads")
    .select("*", { count: "exact" })
    .order("score", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`getLeads: ${error.message}`);
  return { data: data ?? [], count: count ?? 0 };
}

// ---------------------------------------------------------------
// createLead — written by the AI lead-scoring pass (see
// /api/chat/score), never by the customer directly.
// ---------------------------------------------------------------

export async function createLead(data: TablesInsert<"leads">): Promise<Tables<"leads">> {
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .insert(data)
    .select("*")
    .single();

  if (error) throw new Error(`createLead: ${error.message}`);
  return lead;
}

// ---------------------------------------------------------------
// Vehicle admin writes (createVehicle, updateVehicle, deleteVehicle)
// ---------------------------------------------------------------

/** `stock` on create means "initial number of units": that many fleet units
 * are created at the vehicle's home branch (or the first active branch). */
export async function createVehicle(
  data: TablesInsert<"vehicles">
): Promise<Tables<"vehicles">> {
  const { stock: initialUnits = 0, ...fields } = data;

  const { data: vehicle, error } = await supabaseAdmin
    .from("vehicles")
    .insert({ ...fields, stock: 0 })
    .select("*")
    .single();
  if (error) throw new Error(`createVehicle: ${error.message}`);

  if (initialUnits > 0) {
    const branchQuery = supabaseAdmin.from("branches").select("id, provider_id").eq("is_active", true);
    const { data: branch, error: branchError } = fields.location_id
      ? await branchQuery.eq("id", fields.location_id).maybeSingle()
      : await branchQuery.order("id", { ascending: true }).limit(1).maybeSingle();
    if (branchError) throw new Error(`createVehicle: ${branchError.message}`);
    if (!branch) throw new ConflictError("No active branch exists to hold the new vehicle's units.");

    const prefix = vehicle.slug.slice(0, 6).toUpperCase();
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const units = Array.from({ length: initialUnits }, (_, i) => ({
      provider_id: branch.provider_id,
      branch_id: branch.id,
      vehicle_id: vehicle.id,
      plate: `${prefix}-${suffix}-${i + 1}`,
    }));
    const { error: unitsError } = await supabaseAdmin.from("fleet_units").insert(units);
    if (unitsError) throw new Error(`createVehicle: ${unitsError.message}`);
  }

  const { data: refreshed, error: refreshError } = await supabaseAdmin
    .from("vehicles")
    .select("*")
    .eq("id", vehicle.id)
    .single();
  if (refreshError) throw new Error(`createVehicle: ${refreshError.message}`);
  return refreshed;
}

export async function updateVehicle(
  id: string,
  data: Omit<TablesUpdate<"vehicles">, "stock">
): Promise<Tables<"vehicles">> {
  const { data: vehicle, error } = await supabaseAdmin
    .from("vehicles")
    .update(data)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`updateVehicle: ${error.message}`);
  if (!vehicle) throw new NotFoundError(`Vehicle ${id} not found`);
  return vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error, count } = await supabaseAdmin
    .from("vehicles")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) throw new Error(`deleteVehicle: ${error.message}`);
  if (!count) throw new NotFoundError(`Vehicle ${id} not found`);
}

// ---------------------------------------------------------------
// updateBookingStatus — admin-only; unlike createBooking, this is allowed
// to set status directly (see PATCH /api/bookings/[id]).
// ---------------------------------------------------------------

export async function updateBookingStatus(
  id: string,
  status: BookingStatus
): Promise<Tables<"bookings">> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw new Error(`updateBookingStatus: ${existingError.message}`);
  if (!existing) throw new NotFoundError(`Booking ${id} not found`);
  if (existing.status === status) return existing;

  // Legality, unit release and unit relocation all happen in one SQL function.
  const { data: booking, error } = await supabaseAdmin.rpc("transition_booking", {
    p_booking_id: id,
    p_to: status,
  });
  if (error) throw toBookingApiError(error, "updateBookingStatus");
  return booking;
}

// ---------------------------------------------------------------
// getLocations — powers the customer site's pick-up/drop-off dropdowns.
// ---------------------------------------------------------------

export type BranchOption = Pick<Tables<"branches">, "id" | "city" | "country" | "country_code">;

/** Pick-up/drop-off options: active branches of approved providers. Same
 * ids as the legacy `locations` rows, so existing URLs keep working. */
export async function getLocations(): Promise<BranchOption[]> {
  const { data: providers, error: providerError } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("status", "approved");
  if (providerError) throw new Error(`getLocations: ${providerError.message}`);

  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("id, city, country, country_code")
    .eq("is_active", true)
    .in("provider_id", (providers ?? []).map((p) => p.id))
    .order("city", { ascending: true });

  if (error) throw new Error(`getLocations: ${error.message}`);
  return data ?? [];
}
