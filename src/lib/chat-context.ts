import "server-only";

import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Every available car as one line of plain text each, e.g.:
 * `luxury-suv-01 | Range Rover Sport (Land Rover) | exclusive | $120/day | 5 seats | automatic | petrol | GPS, Bluetooth, Child Seat`
 *
 * Plain `|`-separated text (not JSON) because this is meant to be dropped
 * straight into an AI system prompt — see buildSystemPrompt in prompts.ts.
 */
export async function getAvailableVehiclesContext(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .select("slug, name, brand, category, price_per_day, seats, transmission, fuel, features")
    .eq("available", true);

  if (error) throw error;
  if (!data || data.length === 0) return "No vehicles are currently available.";

  const lines = data.map((vehicle) => {
    const features = vehicle.features.length > 0 ? vehicle.features.join(", ") : "no listed features";
    return [
      vehicle.slug,
      `${vehicle.name} (${vehicle.brand})`,
      vehicle.category,
      `$${vehicle.price_per_day}/day`,
      `${vehicle.seats} seats`,
      vehicle.transmission,
      vehicle.fuel,
      features,
    ].join(" | ");
  });

  return lines.join("\n");
}
