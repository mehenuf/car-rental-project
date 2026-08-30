import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ApiError } from "@/lib/errors";

/**
 * Guards an admin-only route handler. `proxy.ts` only gates page navigation
 * under `/admin/*` — it never runs for `/api/*`, so every route that reads
 * or writes admin-only data (leads, bookings, dashboard stats, vehicle
 * writes, booking status changes) needs this called explicitly as the
 * first line of the handler. Throws `ApiError(401)`, which
 * `withErrorHandling` turns into a normal `{ error: { message } }` JSON
 * response — same shape as any other validation failure.
 *
 * Mirrors the admin check in proxy.ts: a session alone isn't enough, since
 * customers can self-register into the same `auth.users` table — only the
 * `role: "admin"` claim in `app_metadata` (settable server-side only)
 * counts.
 */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = !!user && user.app_metadata?.role === "admin";
  if (!isAdmin) {
    throw new ApiError(401, "Admin authentication required");
  }
}
