import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

/**
 * Privileged Supabase client. Uses the service role key, which bypasses
 * Row Level Security entirely — this is how route handlers write to
 * `bookings` and `leads` (see schema.sql: "no public policy, server-side
 * only").
 *
 * The `server-only` import above turns any attempt to bundle this module
 * into client code into a build error, so it can only be imported from
 * Server Components, Route Handlers, or Server Actions.
 */
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
