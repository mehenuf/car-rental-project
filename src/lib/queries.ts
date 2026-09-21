import "server-only";
import { randomBytes } from "crypto";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-server";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { toBookingApiError } from "@/lib/booking-errors";
import { currencyExponent, majorToMinor, minorToMajor } from "@/lib/pricing/money";
import { choosePlace, type VehiclePlace } from "@/lib/vehicle-place";
import { buildPriceScope, type PriceScope } from "@/lib/price-scope";
import { toSnapshot } from "@/lib/pricing/mappers";
import { fetchPage, ilikeContains, type PageResult } from "@/lib/postgrest";
import { quoteForBooking } from "@/lib/pricing/service";
import type {
  BookingSource,
  Json,
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
    const like = ilikeContains(search);
    query = query.or(`name.ilike.${like},brand.ilike.${like},slug.ilike.${like}`);
  }

  const ordered = query.order(sortBy, { ascending: sortOrder === "asc" });
  const { data, error, count } = await fetchPage(
    (a, b) => ordered.range(a, b) as unknown as PromiseLike<PageResult<Tables<"vehicles">>>,
    from,
    to
  );
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
  "id" | "slug" | "name" | "image_url" | "price_per_day" | "available" | "stock" | "rating" | "review_count"
> & {
  /** Where the car is offered and its daily rate there, in that branch's currency. Absent for cars with no rate plan. */
  place?: VehiclePlace | null;
};

const VEHICLE_CARD_COLUMNS = "id, slug, name, image_url, price_per_day, available, stock, rating, review_count";

/** Adds each card's city and local-currency rate from the rate plans of the branches that offer it. */
async function attachPlaces(cards: VehicleCardData[], preferredBranchId?: number): Promise<VehicleCardData[]> {
  if (cards.length === 0) return cards;
  const ids = cards.map((c) => c.id);
  // A rate plan alone does not make a car available somewhere: it also needs an active, approved unit at that branch.
  // The active branches are a small table, so they are read in the same round trip instead of after the plans:
  // one database call fewer in the chain, which is what costs most when the database is far from the server.
  const [{ data: allPlans }, { data: units }, { data: branches }] = await Promise.all([
    supabaseAdmin.from("rate_plans").select("vehicle_id, branch_id, currency, base_daily_minor").in("vehicle_id", ids),
    supabaseAdmin.from("fleet_units").select("vehicle_id, branch_id").in("vehicle_id", ids).eq("status", "active").eq("listing_status", "approved"),
    supabaseAdmin.from("branches").select("id, city").eq("is_active", true).limit(1000),
  ]);
  const offered = new Set((units ?? []).map((u) => `${u.vehicle_id}:${u.branch_id}`));
  const plans = (allPlans ?? []).filter((p) => offered.has(`${p.vehicle_id}:${p.branch_id}`));
  return cards.map((card) => ({
    ...card,
    place: choosePlace(plans.filter((p) => p.vehicle_id === card.id), branches ?? [], preferredBranchId),
  }));
}

/** Where a single car is offered and its daily rate there, preferring the branch the visitor asked for. */
export async function getVehiclePlace(vehicleId: string, preferredBranchId?: number): Promise<VehiclePlace | null> {
  const [card] = await attachPlaces([{ id: vehicleId } as VehicleCardData], preferredBranchId);
  return card?.place ?? null;
}

export async function getVehicleCards(
  filters: VehicleFilters = {}
): Promise<PaginatedResult<VehicleCardData>> {
  const { category, minPrice, maxPrice, seats, transmission, fuel, available, sortOrder = "desc", search } = filters;
  const branchId = filters.locationId ?? filters.availability?.pickupBranchId;

  // Prices are per branch and in that branch's currency, so a price filter or price sort only means something for one
  // place. Without a place they are ignored (the page does not offer them).
  const priceSort = filters.sortBy === "price_per_day" && branchId !== undefined;
  const sortBy = filters.sortBy === "price_per_day" && !priceSort ? "created_at" : (filters.sortBy ?? "created_at");
  let branchPrices: Map<string, number> | null = null;
  let allowedByPrice: string[] | null = null;
  if (branchId !== undefined && (minPrice !== undefined || maxPrice !== undefined || priceSort)) {
    const { data: plans } = await supabaseAdmin
      .from("rate_plans")
      .select("vehicle_id, currency, base_daily_minor")
      .eq("branch_id", branchId);
    branchPrices = new Map((plans ?? []).map((p) => [p.vehicle_id, p.base_daily_minor]));
    const currency = plans?.[0]?.currency ?? "USD";
    const lowest = minPrice !== undefined ? majorToMinor(minPrice, currency) : undefined;
    const highest = maxPrice !== undefined ? majorToMinor(maxPrice, currency) : undefined;
    if (lowest !== undefined || highest !== undefined) {
      allowedByPrice = [...branchPrices]
        .filter(([, minor]) => (lowest === undefined || minor >= lowest) && (highest === undefined || minor <= highest))
        .map(([id]) => id);
    }
  }

  const [from, to] = toRange(filters);

  let query = supabaseAdmin
    .from("vehicles")
    .select(VEHICLE_CARD_COLUMNS, { count: "exact" });

  if (category && category.length > 0) query = query.in("category", category);
  if (seats !== undefined) query = query.gte("seats", seats);
  if (transmission) query = query.eq("transmission", transmission);
  if (fuel) query = query.eq("fuel", fuel);
  if (available !== undefined) query = query.eq("available", available);
  let idFilter = await resolveVehicleIdFilter(filters);
  if (allowedByPrice) {
    const priced = new Set(allowedByPrice);
    idFilter = idFilter ? idFilter.filter((id) => priced.has(id)) : allowedByPrice;
  }
  if (idFilter) {
    if (idFilter.length === 0) return { data: [], count: 0 };
    query = query.in("id", idFilter);
  }
  if (search) {
    const like = ilikeContains(search);
    query = query.or(`name.ilike.${like},brand.ilike.${like},slug.ilike.${like}`);
  }

  if (priceSort && branchPrices) {
    // Ordering by a price held in another table: fetch every match (the catalogue is small), order by the branch's
    // daily rate, then take the requested page.
    const { data, error } = await query;
    if (error) throw new Error(`getVehicleCards: ${error.message}`);
    const prices = branchPrices;
    const direction = sortOrder === "asc" ? 1 : -1;
    const ordered = ((data ?? []) as unknown as VehicleCardData[]).sort(
      (a, b) => direction * ((prices.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (prices.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    );
    return { data: await attachPlaces(ordered.slice(from, to + 1), branchId), count: ordered.length };
  }

  const ordered = query.order(sortBy, { ascending: sortOrder === "asc" });
  const { data, error, count } = await fetchPage(
    (a, b) => ordered.range(a, b) as unknown as PromiseLike<PageResult<VehicleCardData>>,
    from,
    to
  );
  if (error) throw new Error(`getVehicleCards: ${error.message}`);

  const cards = await attachPlaces(data ?? [], branchId);
  return { data: cards, count: count ?? 0 };
}

// ---------------------------------------------------------------
// getVehicleBySlug
// ---------------------------------------------------------------

export const getVehicleBySlug = cache(async function getVehicleBySlug(
  slug: string
): Promise<Tables<"vehicles"> | null> {
  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getVehicleBySlug: ${error.message}`);
  return data ?? null;
});

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
    const like = ilikeContains(search);
    query = query.or(`customer_name.ilike.${like},reference.ilike.${like}`);
  }
  const { data, error, count } = await fetchPage(
    (a, b) =>
      query.order(sortBy, { ascending: sortOrder === "asc" }).range(a, b) as unknown as PromiseLike<
        PageResult<BookingWithVehicle>
      >,
    from,
    to
  );
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
  extras: { code: string; quantity: number }[];
  promo_code: string | null;
  driver_age: number | null;
  /** From POST /api/quote. When present, the live price must still match it. */
  quote_token: string | null;
}

function generateBookingReference(): string {
  return `BC-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Prices the trip on the server (never from the client), then claims a unit
 * and stores the booking together with its immutable price snapshot.
 * Throws PriceChangedError (409 + fresh quote) if a presented token is stale.
 */
export async function createBooking(data: CreateBookingInput): Promise<Tables<"bookings">> {
  const { quote, input } = await quoteForBooking(
    {
      vehicleId: data.vehicle_id,
      pickupBranchId: data.pickup_branch_id,
      dropoffBranchId: data.dropoff_branch_id,
      pickupAt: new Date(data.pickup_at),
      dropoffAt: new Date(data.dropoff_at),
      extras: data.extras,
      promoCode: data.promo_code,
      driverAge: data.driver_age,
    },
    data.quote_token
  );

  const { data: booking, error } = await supabaseAdmin.rpc("create_booking_atomic", {
    p_vehicle_id: data.vehicle_id,
    p_pickup_branch_id: input.pickupBranchId,
    p_dropoff_branch_id: input.dropoffBranchId,
    p_pickup_at: data.pickup_at,
    p_dropoff_at: data.dropoff_at,
    p_customer_name: data.customer_name,
    p_email: data.email,
    p_total_amount: minorToMajor(quote.totalMinor, quote.currency),
    p_reference: generateBookingReference(),
    p_phone: data.phone,
    p_payment_method: data.payment_method,
    p_source: data.source ?? "web",
    p_guest_id: data.guest_id,
    p_user_id: data.user_id,
    p_price_snapshot: toSnapshot(quote, input) as unknown as Json,
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

/** Until providers manage their own prices (sub-project 4), the catalogue
 * `price_per_day` also drives the rate plans of the seeded default provider. */
const DEFAULT_PROVIDER_ID = "00000000-0000-0000-0000-00000000b0c1";

/** `stock` on create means "initial number of units": that many fleet units
 * are created at the vehicle's home branch (or the first active branch),
 * together with a rate plan priced from `price_per_day`. */
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
    const branchQuery = supabaseAdmin
      .from("branches")
      .select("id, provider_id, currency")
      .eq("is_active", true);
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

    const { error: planError } = await supabaseAdmin.from("rate_plans").insert({
      provider_id: branch.provider_id,
      vehicle_id: vehicle.id,
      branch_id: branch.id,
      currency: branch.currency,
      base_daily_minor: majorToMinor(vehicle.price_per_day, branch.currency),
    });
    if (planError) throw new Error(`createVehicle: ${planError.message}`);
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

  if (data.price_per_day !== undefined) {
    const { data: plans, error: plansError } = await supabaseAdmin
      .from("rate_plans")
      .select("id, currency")
      .eq("vehicle_id", id)
      .eq("provider_id", DEFAULT_PROVIDER_ID);
    if (plansError) throw new Error(`updateVehicle: ${plansError.message}`);
    for (const plan of plans ?? []) {
      const { error: planError } = await supabaseAdmin
        .from("rate_plans")
        .update({ base_daily_minor: majorToMinor(vehicle.price_per_day, plan.currency) })
        .eq("id", plan.id);
      if (planError) throw new Error(`updateVehicle: ${planError.message}`);
    }
  }
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

export type BranchOption = Pick<Tables<"branches">, "id" | "name" | "city" | "country" | "country_code">;
export type BranchWithCurrency = BranchOption & { currency: string };

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
    .select("id, name, city, country, country_code")
    .eq("is_active", true)
    .in("provider_id", (providers ?? []).map((p) => p.id))
    .order("city", { ascending: true });

  if (error) throw new Error(`getLocations: ${error.message}`);
  return data ?? [];
}

/** The translated text for a vehicle in one language, or null when there is none (English is the fallback). */
export async function getVehicleTranslation(vehicleId: string, lang: string) {
  if (lang === "en") return null;
  const { data, error } = await supabaseAdmin
    .from("vehicle_translations")
    .select("description, features")
    .eq("vehicle_id", vehicleId)
    .eq("lang", lang as "de")
    .maybeSingle();
  if (error) throw new Error(`getVehicleTranslation: ${error.message}`);
  return data ?? null;
}

/** The city of a branch, for saying where a booking is picked up. */
export async function getBranchCity(id: number): Promise<string | null> {
  const { data } = await supabaseAdmin.from("branches").select("city").eq("id", id).maybeSingle();
  return data?.city ?? null;
}

/** One active branch as a place (used to say where a list of cars is being shown). */
export async function getBranchPlace(id: number): Promise<BranchWithCurrency | null> {
  const { data } = await supabaseAdmin
    .from("branches")
    .select("id, name, city, country, country_code, currency")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

/** The price range a branch offers, for the filter slider: its currency and the dearest daily rate, rounded up. */
export async function getBranchPriceScope(branchId: number, currency: string): Promise<PriceScope | null> {
  const { data } = await supabaseAdmin
    .from("rate_plans")
    .select("base_daily_minor")
    .eq("branch_id", branchId)
    .order("base_daily_minor", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return buildPriceScope(currency, data.base_daily_minor, currencyExponent(currency));
}
