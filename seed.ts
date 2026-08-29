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
  return arr[randomInt(0, arr.length - 1)];
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
  { name: "Honda Civic", brand: "Honda", category: "popular", price: 48, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1590362891991-f776e747a588" },
  { name: "Volkswagen Golf", brand: "Volkswagen", category: "popular", price: 50, seats: 5, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1622551941772-a0e2f4a54f1b" },
  { name: "Hyundai Elantra", brand: "Hyundai", category: "popular", price: 42, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1617469767053-d3b523a0b982" },
  { name: "Ford Focus", brand: "Ford", category: "popular", price: 44, seats: 5, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d" },
  { name: "Nissan Sentra", brand: "Nissan", category: "popular", price: 43, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d" },

  // Large
  { name: "Toyota Land Cruiser", brand: "Toyota", category: "large", price: 120, seats: 7, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf" },
  { name: "Chevrolet Suburban", brand: "Chevrolet", category: "large", price: 135, seats: 8, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b" },
  { name: "Ford Explorer", brand: "Ford", category: "large", price: 110, seats: 7, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca" },
  { name: "Kia Carnival", brand: "Kia", category: "large", price: 95, seats: 8, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1621007805272-611562e9899a" },
  { name: "Honda Pilot", brand: "Honda", category: "large", price: 105, seats: 7, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1568844293986-8d0400bd4745" },
  { name: "GMC Yukon", brand: "GMC", category: "large", price: 140, seats: 8, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1605559911160-a3d95d213904" },

  // Small
  { name: "Fiat 500", brand: "Fiat", category: "small", price: 30, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1541443131876-44b03de101c5" },
  { name: "Mini Cooper", brand: "Mini", category: "small", price: 38, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1617654112368-307921291f42" },
  { name: "Smart ForTwo", brand: "Smart", category: "small", price: 28, seats: 2, transmission: "automatic", fuel: "electric", image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341" },
  { name: "Volkswagen Up!", brand: "Volkswagen", category: "small", price: 27, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1502877338535-766e1452684a" },
  { name: "Kia Picanto", brand: "Kia", category: "small", price: 26, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1591293835940-8f6c94a12a10" },
  { name: "Toyota Aygo", brand: "Toyota", category: "small", price: 25, seats: 4, transmission: "manual", fuel: "petrol", image: "https://images.unsplash.com/photo-1622199815353-2f7d0e6ad0a0" },

  // Exclusive
  { name: "BMW 5 Series", brand: "BMW", category: "exclusive", price: 180, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1555215695-3004980ad54e" },
  { name: "Mercedes-Benz E-Class", brand: "Mercedes-Benz", category: "exclusive", price: 190, seats: 5, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1563720223185-11003d516935" },
  { name: "Audi A6", brand: "Audi", category: "exclusive", price: 175, seats: 5, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6" },
  { name: "Tesla Model S", brand: "Tesla", category: "exclusive", price: 220, seats: 5, transmission: "automatic", fuel: "electric", image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89" },
  { name: "Porsche Panamera", brand: "Porsche", category: "exclusive", price: 260, seats: 4, transmission: "automatic", fuel: "petrol", image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70" },
  { name: "Range Rover Sport", brand: "Land Rover", category: "exclusive", price: 210, seats: 5, transmission: "automatic", fuel: "diesel", image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b" },
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
  if (roll < 0.72) return "success";
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
  await supabase.from("locations").delete().neq("id", 0);
  await supabase.from("daily_stats").delete().neq("date", "1900-01-01");

  console.log("Inserting locations...");
  const { data: insertedLocations, error: locError } = await supabase
    .from("locations")
    .insert(LOCATIONS)
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
    description: `A reliable ${v.brand} ${v.name}, well maintained and ready for your next trip.`,
    features: shuffleAndTake(FEATURES_POOL, randomInt(3, 6)),
    rating: (4 + Math.random()).toFixed(1),
    review_count: randomInt(8, 240),
    stock: randomInt(1, 6),
    available: true,
    location_id: pick(insertedLocations!).id,
  }));

  const { data: insertedVehicles, error: vehError } = await supabase
    .from("vehicles")
    .insert(vehicleRows)
    .select();
  if (vehError) throw vehError;

  console.log(`Inserted ${insertedVehicles!.length} vehicles.`);

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
      pickup_location_id: pickupLoc.id,
      dropoff_location_id: dropoffLoc.id,
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
  console.log(`  - ${insertedLocations!.length} locations`);
  console.log(`  - ${insertedVehicles!.length} vehicles`);
  console.log(`  - ${bookingRows.length} bookings`);
  console.log("\nOpen Supabase > Table Editor to see them.");
}

function shuffleAndTake<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
