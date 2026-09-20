// seed.ts — fills the database with realistic sample data.
//
// WHAT THIS DOES, IN PLAIN TERMS:
// It creates 24 pretend cars and about 200 pretend bookings, spread out
// over the last 12 months, so your dashboard charts and tables have
// something real to show instead of being empty or fake-looking.
//
// HOW TO RUN IT:
// 1. Save this file as seed.ts in your project's root folder (or a /scripts folder).
// 2. Make sure your .env.local file has these two lines (from Supabase Settings > API):
//      NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//      SUPABASE_SERVICE_ROLE_KEY=eyJ....   <- use the SERVICE ROLE key here, not the public one,
//                                              because seeding needs to bypass the read-only rules.
// 3. In your terminal, run:
//      npm install @supabase/supabase-js dotenv tsx --save-dev
//      npx tsx seed.ts
// 4. Check the "Table Editor" tab in Supabase — you should see 24 rows in
//    "vehicles" and about 200 rows in "bookings".
//
// You can re-run this script any time to wipe and refill the data.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// dotenv/config on its own only looks for a file named ".env" —
// we need to explicitly point it at ".env.local" instead.
config({ path: ".env.local" });

// Seeded by migration 0003; every seeded branch, unit and booking belongs to it.
const DEFAULT_PROVIDER_ID = "00000000-0000-0000-0000-00000000b0c1";

// Small local-currency providers so the local payment methods (iDEAL, UPI, bKash, M-Pesa)
// appear in the demo. Prices, extras and deposits are the USD demo values times `fx`.
const DEMO_PROVIDERS = [
  { id: "00000000-0000-0000-0000-00000000d001", name: "BestCar Amsterdam", country: "Netherlands", code: "NL", city: "Amsterdam", currency: "EUR", fx: 0.92 },
  { id: "00000000-0000-0000-0000-00000000d002", name: "BestCar Mumbai", country: "India", code: "IN", city: "Mumbai", currency: "INR", fx: 83 },
  { id: "00000000-0000-0000-0000-00000000d003", name: "BestCar Dhaka", country: "Bangladesh", code: "BD", city: "Dhaka", currency: "BDT", fx: 110 },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

const supabase = createClient(supabaseUrl, serviceKey);

// ---------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Spreads dates across the last 12 months, weighted so recent months
// have slightly more bookings than a year ago — looks like a growing business.
function randomDateInLastYear() {
  const now = new Date();
  const daysAgo = Math.floor(Math.pow(Math.random(), 1.3) * 365); // skews recent
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(randomInt(0, 23), randomInt(0, 59));
  return date;
}

function bookingReference() {
  return "BC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ---------------------------------------------------------------
// Sample locations (used for "Sales by Countries" widget)
// ---------------------------------------------------------------

const LOCATIONS = [
  { city: "London", country: "United Kingdom", country_code: "GB" },
  { city: "Manchester", country: "United Kingdom", country_code: "GB" },
  { city: "New York", country: "United States", country_code: "US" },
  { city: "Los Angeles", country: "United States", country_code: "US" },
  { city: "Lagos", country: "Nigeria", country_code: "NG" },
  { city: "Nairobi", country: "Kenya", country_code: "KE" },
  { city: "Dubai", country: "United Arab Emirates", country_code: "AE" },
  { city: "Jakarta", country: "Indonesia", country_code: "ID" },
  { city: "Sao Paulo", country: "Brazil", country_code: "BR" },
  { city: "Toronto", country: "Canada", country_code: "CA" },
];

// ---------------------------------------------------------------
// 24 sample vehicles — real car names, real Unsplash photo links,
// spread across the four categories used in the front-end tabs.
// ---------------------------------------------------------------

const VEHICLES = [
  // Popular
  { name: "Toyota Corolla", brand: "Toyota", category: "popular", price: 45, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb" },
  { name: "Honda Civic", brand: "Honda", category: "popular", price: 48, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1594070319944-7c0cbebb6f58" },
  { name: "Volkswagen Golf", brand: "Volkswagen", category: "popular", price: 50, seats: 5, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1605475300127-0a31e8273bc2" },
  { name: "Hyundai Elantra", brand: "Hyundai", category: "popular", price: 42, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1645145214095-84fca73e0cc5" },
  { name: "Ford Focus", brand: "Ford", category: "popular", price: 44, seats: 5, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1551206820-1a2050e76dd7" },
  { name: "Nissan Sentra", brand: "Nissan", category: "popular", price: 43, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1568074531989-e069eaf92fd2" },

  // Large
  { name: "Toyota Land Cruiser", brand: "Toyota", category: "large", price: 120, seats: 7, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1650530579355-7ad9d4766043" },
  { name: "Chevrolet Suburban", brand: "Chevrolet", category: "large", price: 135, seats: 8, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1597730071805-f87fe40f6796" },
  { name: "Ford Explorer", brand: "Ford", category: "large", price: 110, seats: 7, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1606611013016-969c19ba27bb" },
  { name: "Kia Carnival", brand: "Kia", category: "large", price: 95, seats: 8, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1672216197924-89b8d14a47b1" },
  { name: "Honda Pilot", brand: "Honda", category: "large", price: 105, seats: 7, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1708148246994-b7b3c818090d" },
  { name: "GMC Yukon", brand: "GMC", category: "large", price: 140, seats: 8, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1761318752375-978b6922a157" },

  // Small
  { name: "Fiat 500", brand: "Fiat", category: "small", price: 30, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1536667842290-7602f6a43a2b" },
  { name: "Mini Cooper", brand: "Mini", category: "small", price: 38, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1600016326108-40b24ee22cd3" },
  { name: "Smart ForTwo", brand: "Smart", category: "small", price: 28, seats: 2, transmission: "automatic", fuel: "electric", image: "https://images.unsplash.com/photo-1777226807153-f73e2b74506c" },
  { name: "Volkswagen Up!", brand: "Volkswagen", category: "small", price: 27, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1550948505-31ddd529fe61" },
  { name: "Kia Picanto", brand: "Kia", category: "small", price: 26, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1628066961967-de52104e87a4" },
  { name: "Toyota Aygo", brand: "Toyota", category: "small", price: 25, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1604046938596-c6561689c9ee" },

  // Exclusive
  { name: "BMW 5 Series", brand: "BMW", category: "exclusive", price: 180, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1555215695-3004980ad54e" },
  { name: "Mercedes-Benz E-Class", brand: "Mercedes-Benz", category: "exclusive", price: 190, seats: 5, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1609703048009-d3576872b32c" },
  { name: "Audi A6", brand: "Audi", category: "exclusive", price: 175, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6" },
  { name: "Tesla Model S", brand: "Tesla", category: "exclusive", price: 220, seats: 5, transmission: "automatic", fuel: "electric", image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89" },
  { name: "Porsche Panamera", brand: "Porsche", category: "exclusive", price: 260, seats: 4, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70" },
  { name: "Range Rover Sport", brand: "Land Rover", category: "exclusive", price: 210, seats: 5, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1549632891-a0bea6d0355b" },
];

const FEATURES_POOL = [
  "GPS Navigation",
  "Bluetooth",
  "Child Seat Available",
  "Air Conditioning",
  "Cruise Control",
  "Reverse Camera",
  "Unlimited Mileage",
  "USB Charging",
];

const PAYMENT_METHODS = ["paypal", "stripe", "apple_pay", "payu", "paytm"] as const;

// Status mix: mostly successful, some pending, a few cancelled —
// this is what makes the dashboard numbers look like a real business.
function randomStatus() {
  const roll = Math.random();
  if (roll < 0.72) return "completed";
  if (roll < 0.9) return "pending";
  return "cancelled";
}

const FIRST_NAMES = ["James", "Sarah", "Mike", "Fatima", "Carlos", "Aisha", "Liam", "Priya", "Tom", "Grace", "Ben", "Nadia"];
const LAST_NAMES = ["Witzel", "Chowdhury", "Garcia", "Okafor", "Silva", "Nguyen", "Smith", "Ahmed", "Brown", "Kim"];

function randomPersonName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// ---------------------------------------------------------------
// Main seeding logic
// ---------------------------------------------------------------

async function main() {
  console.log("Clearing old data...");
  // Delete in an order that respects foreign keys.
  await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bookings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("vehicles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // Pricing config that does not cascade from vehicles or branches.
  await supabase.from("extras").delete().eq("provider_id", DEFAULT_PROVIDER_ID);
  await supabase.from("provider_policies").delete().eq("provider_id", DEFAULT_PROVIDER_ID);
  await supabase.from("tax_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("promo_codes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // Deleting vehicles cascades to fleet_units and rate_plans; bookings are already gone.
  await supabase.from("branches").delete().eq("provider_id", DEFAULT_PROVIDER_ID);
  // Demo providers cascade to their branches, rate plans, extras and policies.
  await supabase.from("providers").delete().in("id", DEMO_PROVIDERS.map((p) => p.id));
  await supabase.from("daily_stats").delete().neq("date", "1900-01-01");

  console.log("Inserting branches...");
  const { data: insertedLocations, error: locError } = await supabase
    .from("branches")
    .insert(
      LOCATIONS.map((l, i) => ({
        provider_id: DEFAULT_PROVIDER_ID,
        code: `${l.country_code}-${i + 1}`,
        name: `${l.city} Branch`,
        city: l.city,
        country: l.country,
        country_code: l.country_code,
        currency: "USD",
      }))
    )
    .select();
  if (locError) throw locError;

  console.log("Inserting vehicles...");
  const vehicleRows = VEHICLES.map((v) => ({
    slug: slugify(v.name),
    name: v.name,
    brand: v.brand,
    category: v.category,
    price_per_day: v.price,
    seats: v.seats,
    doors: v.seats <= 2 ? 2 : 4,
    transmission: v.transmission,
    fuel: v.fuel,
    image_url: `${v.image}?auto=format&fit=crop&w=800&q=80`,
    gallery: [
      `${v.image}?auto=format&fit=crop&w=1200&q=80`,
    ],
    description: `A reliable ${v.name}, well maintained and ready for your next trip.`,
    features: shuffleAndTake(FEATURES_POOL, randomInt(3, 6)),
    rating: (4 + Math.random()).toFixed(1),
    review_count: randomInt(8, 240),
    stock: 0, // fleet units are created below; a trigger keeps stock in sync
    available: true,
    location_id: pick(insertedLocations!).id,
  }));

  const { data: insertedVehicles, error: vehError } = await supabase
    .from("vehicles")
    .insert(vehicleRows)
    .select();
  if (vehError) throw vehError;

  console.log(`Inserted ${insertedVehicles!.length} vehicles.`);

  console.log("Inserting fleet units...");
  const unitRows = insertedVehicles!.flatMap((v) =>
    Array.from({ length: randomInt(1, 5) }, (_, i) => ({
      provider_id: DEFAULT_PROVIDER_ID,
      branch_id: v.location_id as number,
      vehicle_id: v.id as string,
      plate: `${String(v.slug).toUpperCase()}-${i + 1}`,
    }))
  );
  const { error: unitError } = await supabase.from("fleet_units").insert(unitRows);
  if (unitError) throw unitError;

  console.log("Inserting pricing config...");
  const { data: planRows, error: planError } = await supabase
    .from("rate_plans")
    .insert(
      insertedVehicles!.map((v) => ({
        provider_id: DEFAULT_PROVIDER_ID,
        vehicle_id: v.id as string,
        branch_id: v.location_id as number,
        currency: "USD",
        base_daily_minor: Math.round(Number(v.price_per_day) * 100),
        weekend_uplift_bp: 1000, // +10% on Saturdays and Sundays
        weekly_discount_bp: 1000, // 10% off from 7 days
        monthly_discount_bp: 2000, // 20% off from 28 days
      }))
    )
    .select("id, base_daily_minor");
  if (planError) throw planError;

  // A summer season (+25%) on every third vehicle, next year so it never overlaps today's data.
  const seasonYear = new Date().getFullYear() + 1;
  const seasonRows = planRows!
    .filter((_, i) => i % 3 === 0)
    .map((p) => ({
      rate_plan_id: p.id as string,
      provider_id: DEFAULT_PROVIDER_ID,
      during: `[${seasonYear}-06-15,${seasonYear}-09-01)`,
      daily_minor: Math.round(Number(p.base_daily_minor) * 1.25),
    }));
  const { error: seasonError } = await supabase.from("rate_seasons").insert(seasonRows);
  if (seasonError) throw seasonError;

  const { error: extrasError } = await supabase.from("extras").insert([
    { provider_id: DEFAULT_PROVIDER_ID, code: "seat", name: "Child seat", kind: "extra", pricing: "per_day", unit_price_minor: 800, currency: "USD", max_quantity: 2, cap_minor: 5600 },
    { provider_id: DEFAULT_PROVIDER_ID, code: "gps", name: "GPS navigation", kind: "extra", pricing: "per_day", unit_price_minor: 1000, currency: "USD", max_quantity: 1, cap_minor: 7000 },
    { provider_id: DEFAULT_PROVIDER_ID, code: "driver", name: "Additional driver", kind: "extra", pricing: "per_rental", unit_price_minor: 1500, currency: "USD", max_quantity: 2 },
    { provider_id: DEFAULT_PROVIDER_ID, code: "cdw", name: "Collision damage waiver", kind: "insurance", pricing: "per_day", unit_price_minor: 1200, currency: "USD", max_quantity: 1, is_mandatory: true },
  ]);
  if (extrasError) throw extrasError;

  const { error: policyError } = await supabase.from("provider_policies").insert({
    provider_id: DEFAULT_PROVIDER_ID,
    deposit_type: "fixed",
    deposit_value: 20000, // $200 refundable hold
    cancellation_tiers: [
      { hours_before: 48, refund_bp: 10000 },
      { hours_before: 24, refund_bp: 5000 },
      { hours_before: 0, refund_bp: 0 },
    ],
    min_driver_age: 21,
    young_driver_age: 25,
    young_driver_fee_minor: 1500,
  });
  if (policyError) throw policyError;

  // One-way fee between any two branches.
  const oneWayRows = insertedLocations!.flatMap((from) =>
    insertedLocations!
      .filter((to) => to.id !== from.id)
      .map((to) => ({ provider_id: DEFAULT_PROVIDER_ID, from_branch_id: from.id as number, to_branch_id: to.id as number, amount_minor: 3500 }))
  );
  const { error: oneWayError } = await supabase.from("one_way_fees").insert(oneWayRows);
  if (oneWayError) throw oneWayError;

  // Demo tax rules (illustrative rates, not tax advice).
  const { error: taxError } = await supabase.from("tax_rules").insert([
    { country_code: "GB", name: "VAT", rate_bp: 2000, applies_to: ["rental", "extras", "fees"], inclusive: true },
    { country_code: "NG", name: "VAT", rate_bp: 750, applies_to: ["rental", "extras", "fees"], inclusive: false },
    { country_code: "KE", name: "VAT", rate_bp: 1600, applies_to: ["rental", "extras", "fees"], inclusive: false },
    { country_code: "AE", name: "VAT", rate_bp: 500, applies_to: ["rental", "extras", "fees"], inclusive: false },
    { country_code: "ID", name: "PPN", rate_bp: 1100, applies_to: ["rental", "extras", "fees"], inclusive: false },
    { country_code: "CA", name: "GST", rate_bp: 500, applies_to: ["rental", "extras", "fees"], inclusive: false },
    { country_code: "NL", name: "BTW", rate_bp: 2100, applies_to: ["rental", "extras", "fees"], inclusive: true },
    { country_code: "IN", name: "GST", rate_bp: 1800, applies_to: ["rental", "extras", "fees"], inclusive: false },
    { country_code: "BD", name: "VAT", rate_bp: 1500, applies_to: ["rental", "extras", "fees"], inclusive: false },
  ]);
  if (taxError) throw taxError;

  const { error: promoError } = await supabase.from("promo_codes").insert([
    { code: "WELCOME10", issuer: "platform", discount_type: "percent", value: 1000 },
    { code: "WEEKEND25", issuer: "platform", discount_type: "fixed", value: 2500, currency: "USD", min_days: 3 },
  ]);
  if (promoError) throw promoError;

  // Local-currency demo providers: one branch each, the first six vehicles, their own policy and extras.
  for (const demo of DEMO_PROVIDERS) {
    const { error: providerError } = await supabase.from("providers").insert({
      id: demo.id,
      type: "company",
      legal_name: `${demo.name} Ltd`,
      display_name: demo.name,
      country_code: demo.code,
      default_currency: demo.currency,
      status: "approved",
    });
    if (providerError) throw providerError;

    const { data: demoBranch, error: demoBranchError } = await supabase
      .from("branches")
      .insert({
        provider_id: demo.id,
        code: `${demo.code}-1`,
        name: `${demo.city} Branch`,
        city: demo.city,
        country: demo.country,
        country_code: demo.code,
        currency: demo.currency,
      })
      .select()
      .single();
    if (demoBranchError) throw demoBranchError;

    const demoVehicles = insertedVehicles!.slice(0, 6);
    const { error: demoUnitError } = await supabase.from("fleet_units").insert(
      demoVehicles.map((v) => ({
        provider_id: demo.id,
        branch_id: demoBranch.id as number,
        vehicle_id: v.id as string,
        plate: `${String(v.slug).toUpperCase()}-${demo.code}-1`,
      }))
    );
    if (demoUnitError) throw demoUnitError;

    const { error: demoPlanError } = await supabase.from("rate_plans").insert(
      demoVehicles.map((v) => ({
        provider_id: demo.id,
        vehicle_id: v.id as string,
        branch_id: demoBranch.id as number,
        currency: demo.currency,
        base_daily_minor: Math.round(Number(v.price_per_day) * demo.fx * 100),
        weekend_uplift_bp: 1000,
        weekly_discount_bp: 1000,
      }))
    );
    if (demoPlanError) throw demoPlanError;

    const scale = (usdMinor: number) => Math.round(usdMinor * demo.fx);
    const { error: demoExtrasError } = await supabase.from("extras").insert([
      { provider_id: demo.id, code: "seat", name: "Child seat", kind: "extra", pricing: "per_day", unit_price_minor: scale(800), currency: demo.currency, max_quantity: 2 },
      { provider_id: demo.id, code: "cdw", name: "Collision damage waiver", kind: "insurance", pricing: "per_day", unit_price_minor: scale(1200), currency: demo.currency, max_quantity: 1, is_mandatory: true },
    ]);
    if (demoExtrasError) throw demoExtrasError;

    const { error: demoPolicyError } = await supabase.from("provider_policies").insert({
      provider_id: demo.id,
      deposit_type: "fixed",
      deposit_value: scale(20000),
      cancellation_tiers: [
        { hours_before: 48, refund_bp: 10000 },
        { hours_before: 0, refund_bp: 0 },
      ],
      min_driver_age: 21,
    });
    if (demoPolicyError) throw demoPolicyError;
  }

  console.log("Generating ~200 bookings across the last 12 months...");
  const bookingRows = Array.from({ length: 200 }).map(() => {
    const vehicle = pick(insertedVehicles!);
    const pickupLoc = pick(insertedLocations!);
    const dropoffLoc = pick(insertedLocations!);
    const createdAt = randomDateInLastYear();

    const pickupAt = new Date(createdAt);
    pickupAt.setDate(pickupAt.getDate() + randomInt(1, 10));

    const rentalDays = randomInt(1, 7);
    const dropoffAt = new Date(pickupAt);
    dropoffAt.setDate(dropoffAt.getDate() + rentalDays);

    const total = Number((vehicle.price_per_day * rentalDays).toFixed(2));

    return {
      reference: bookingReference(),
      vehicle_id: vehicle.id,
      customer_name: randomPersonName(),
      email: `customer${randomInt(1000, 9999)}@example.com`,
      phone: `+1${randomInt(200, 999)}${randomInt(1000000, 9999999)}`,
      provider_id: DEFAULT_PROVIDER_ID,
      pickup_branch_id: pickupLoc.id,
      dropoff_branch_id: dropoffLoc.id,
      currency: "USD",
      pickup_at: pickupAt.toISOString(),
      dropoff_at: dropoffAt.toISOString(),
      total_amount: total,
      payment_method: pick(PAYMENT_METHODS),
      status: randomStatus(),
      lead_score: randomInt(20, 95),
      source: pick(["web", "web", "web", "chat"]), // mostly web, some from the AI chat
      created_at: createdAt.toISOString(),
    };
  });

  // Insert in batches of 50 — friendlier to the free-tier connection limits.
  for (let i = 0; i < bookingRows.length; i += 50) {
    const batch = bookingRows.slice(i, i + 50);
    const { error } = await supabase.from("bookings").insert(batch);
    if (error) throw error;
    console.log(`  Inserted bookings ${i + 1}-${i + batch.length}`);
  }

  console.log("Refreshing daily_stats summary table...");
  const { error: statsError } = await supabase.rpc("refresh_daily_stats");
  if (statsError) throw statsError;

  console.log("\nDone. Your database now has:");
  console.log(`  - ${insertedLocations!.length} branches`);
  console.log(`  - ${insertedVehicles!.length} vehicles`);
  console.log(`  - ${bookingRows.length} bookings`);
  console.log("\nOpen Supabase > Table Editor to see them.");
}

function shuffleAndTake<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, count);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
