import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

/**
 * Browser-safe Supabase client. Uses the public anon key, so it only ever
 * sees what Row Level Security in schema.sql allows (public read on
 * `vehicles` and `locations`; no access to `bookings` or `leads`).
 *
 * Safe to import from Client Components. For privileged access, use
 * `supabaseAdmin` from `@/lib/supabase-server` instead — never import that
 * module here or from a Client Component.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
