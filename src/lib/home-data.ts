import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import { citySlug } from "@/lib/seo/city";
import { publicReviewer, shortestFit } from "@/lib/home-format";

export interface MarketplaceFacts {
  cars: number;
  cities: number;
  hosts: number;
  showcase: { name: string; imageUrl: string; slug: string }[];
}

export interface CityTile {
  slug: string;
  city: string;
  countryCode: string;
  cars: number;
  hosts: number;
}

export interface FeaturedReview {
  id: string;
  overall: number;
  comment: string;
  vehicleName: string;
  reviewer: string;
}

/** Live numbers for the landing page: only branches of approved hosts with active cars count. */
export async function getCityShelf(): Promise<{ tiles: CityTile[]; hosts: number }> {
  const [{ data: providers }, { data: branches }, { data: units }] = await Promise.all([
    supabaseAdmin.from("providers").select("id").eq("status", "approved"),
    supabaseAdmin.from("branches").select("id, city, country_code, provider_id").eq("is_active", true),
    supabaseAdmin.from("fleet_units").select("branch_id, vehicle_id").eq("status", "active").eq("listing_status", "approved"),
  ]);
  const approved = new Set((providers ?? []).map((p) => p.id));
  const byBranch = new Map<number, Set<string>>();
  for (const u of units ?? []) {
    if (!byBranch.has(u.branch_id)) byBranch.set(u.branch_id, new Set());
    byBranch.get(u.branch_id)!.add(u.vehicle_id);
  }
  const cities = new Map<string, { city: string; countryCode: string; cars: Set<string>; hosts: Set<string> }>();
  for (const b of branches ?? []) {
    if (!approved.has(b.provider_id)) continue;
    const cars = byBranch.get(b.id);
    if (!cars || cars.size === 0) continue;
    const slug = citySlug(b.city);
    if (!slug) continue;
    const entry = cities.get(slug) ?? { city: b.city, countryCode: b.country_code, cars: new Set<string>(), hosts: new Set<string>() };
    cars.forEach((c) => entry.cars.add(c));
    entry.hosts.add(b.provider_id);
    cities.set(slug, entry);
  }
  const tiles = [...cities.entries()]
    .map(([slug, e]) => ({ slug, city: e.city, countryCode: e.countryCode, cars: e.cars.size, hosts: e.hosts.size }))
    .sort((a, b) => b.cars - a.cars || a.city.localeCompare(b.city))
    .slice(0, 10);
  return { tiles, hosts: approved.size };
}

export async function getMarketplaceFacts(cityCount: number, hosts: number): Promise<MarketplaceFacts> {
  const [{ count }, { data: showcase }] = await Promise.all([
    supabaseAdmin.from("vehicles").select("id", { count: "exact", head: true }).eq("available", true),
    supabaseAdmin.from("vehicles").select("name, image_url, slug").eq("available", true).order("rating", { ascending: false }).limit(3),
  ]);
  return {
    cars: count ?? 0,
    cities: cityCount,
    hosts,
    showcase: (showcase ?? []).map((v) => ({ name: v.name, imageUrl: v.image_url, slug: v.slug })),
  };
}

/** Published reviews with a written comment, best first. Nothing is invented: with none, the section is not shown. */
export async function getFeaturedReviews(limit = 3): Promise<FeaturedReview[]> {
  const { data: reviews } = await supabaseAdmin
    .from("reviews")
    .select("id, overall, comment, vehicle_id, booking_id")
    .eq("status", "published")
    .eq("direction", "customer_to_provider")
    .gte("overall", 4)
    .not("comment", "is", null)
    .order("published_at", { ascending: false })
    .limit(40);
  const usable = shortestFit(
    (reviews ?? []).filter((r) => (r.comment ?? "").trim().length >= 40),
    (r) => r.comment ?? "",
    limit,
    240,
  );
  if (usable.length === 0) return [];
  const vehicleIds = [...new Set(usable.map((r) => r.vehicle_id).filter((v): v is string => Boolean(v)))];
  const bookingIds = usable.map((r) => r.booking_id);
  const [{ data: vehicles }, { data: bookings }] = await Promise.all([
    supabaseAdmin.from("vehicles").select("id, name").in("id", vehicleIds),
    supabaseAdmin.from("bookings").select("id, customer_name").in("id", bookingIds),
  ]);
  const vehicleName = new Map((vehicles ?? []).map((v) => [v.id, v.name]));
  const customer = new Map((bookings ?? []).map((b) => [b.id, b.customer_name]));
  return usable.map((r) => ({
    id: r.id,
    overall: r.overall,
    comment: (r.comment ?? "").trim(),
    vehicleName: (r.vehicle_id && vehicleName.get(r.vehicle_id)) || "",
    reviewer: publicReviewer(customer.get(r.booking_id) ?? ""),
  }));
}
