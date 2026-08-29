import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NotFoundError } from "@/lib/errors";
import type {
  BookingStatus,
  Fuel,
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

/** Number of whole days between two dates, matching the `bookings.days`
 * generated column formula: `greatest(1, extract(day from (dropoff - pickup)))`. */
function daysBetween(pickupAt: string | Date, dropoffAt: string | Date): number {
  const pickup = new Date(pickupAt).getTime();
  const dropoff = new Date(dropoffAt).getTime();
  const diffDays = Math.floor((dropoff - pickup) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
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
  category?: VehicleCategory;
  minPrice?: number;
  maxPrice?: number;
  seats?: number;
  transmission?: Transmission;
  fuel?: Fuel;
  available?: boolean;
  sortBy?: VehicleSortBy;
  sortOrder?: SortOrder;
  /** Case-insensitive match against name, brand, or slug. */
  search?: string;
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

  if (category) query = query.eq("category", category);
  if (minPrice !== undefined) query = query.gte("price_per_day", minPrice);
  if (maxPrice !== undefined) query = query.lte("price_per_day", maxPrice);
  if (seats !== undefined) query = query.gte("seats", seats);
  if (transmission) query = query.eq("transmission", transmission);
  if (fuel) query = query.eq("fuel", fuel);
  if (available !== undefined) query = query.eq("available", available);
  if (search) {
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`getVehicles: ${error.message}`);

  return { data: data ?? [], count: count ?? 0 };
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
  const current = await sumDailyStats(startDate, endDate);
  const prev = previousPeriod(startDate, endDate);
  const previous = await sumDailyStats(prev.start, prev.end);

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
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
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
    revenueByMonth[month] += row.revenue ?? 0;
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

export type CreateBookingInput = Omit<
  TablesInsert<"bookings">,
  "id" | "reference" | "total_amount" | "created_at"
>;

function generateBookingReference(): string {
  return `BC-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createBooking(
  data: CreateBookingInput
): Promise<Tables<"bookings">> {
  if (!data.vehicle_id) {
    throw new Error("createBooking: vehicle_id is required");
  }

  const { data: vehicle, error: vehicleError } = await supabaseAdmin
    .from("vehicles")
    .select("price_per_day")
    .eq("id", data.vehicle_id)
    .maybeSingle();

  if (vehicleError) throw new Error(`createBooking: ${vehicleError.message}`);
  if (!vehicle) throw new NotFoundError(`Vehicle ${data.vehicle_id} not found`);

  const days = daysBetween(data.pickup_at, data.dropoff_at);
  const totalAmount = Math.round(vehicle.price_per_day * days * 100) / 100;

  const insertPayload: TablesInsert<"bookings"> = {
    ...data,
    reference: generateBookingReference(),
    total_amount: totalAmount,
  };

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw new Error(`createBooking: ${error.message}`);
  return booking;
}

// ---------------------------------------------------------------
// getLeads
// ---------------------------------------------------------------

export async function getLeads(limit: number = 20): Promise<Tables<"leads">[]> {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getLeads: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------
// Vehicle admin writes (createVehicle, updateVehicle, deleteVehicle)
// ---------------------------------------------------------------

export async function createVehicle(
  data: TablesInsert<"vehicles">
): Promise<Tables<"vehicles">> {
  const { data: vehicle, error } = await supabaseAdmin
    .from("vehicles")
    .insert(data)
    .select("*")
    .single();

  if (error) throw new Error(`createVehicle: ${error.message}`);
  return vehicle;
}

export async function updateVehicle(
  id: string,
  data: TablesUpdate<"vehicles">
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
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`updateBookingStatus: ${error.message}`);
  if (!booking) throw new NotFoundError(`Booking ${id} not found`);
  return booking;
}
