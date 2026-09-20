import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "crypto";
import type { User } from "@supabase/supabase-js";

const GUEST_COOKIE = "bc_guest";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Identity for the current request: a signed-in customer's `user_id`, or a
 * `guest_id` issued to this browser in an httpOnly cookie. Exactly one of
 * the two is set. Used to link bookings back to "my bookings" without
 * requiring login (see /api/bookings/mine and /dashboard).
 */
export interface RequestIdentity {
  userId: string | null;
  guestId: string | null;
  user: User | null;
}

async function getSupabaseSessionUser(writable: boolean): Promise<User | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Server Components can only read cookies, never write them — if a
        // token refresh is needed there, silently skip it (the next Route
        // Handler request will refresh it) instead of throwing.
        setAll(cookiesToSet) {
          if (!writable) return;
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
  return user;
}

/** The signed-in user for this request, or null. Pass `writable: true` from Route Handlers so a refreshed token is saved. */
export async function getSessionUser(writable = false): Promise<User | null> {
  return getSupabaseSessionUser(writable);
}

/**
 * Resolves who is making this request. If signed in, `userId` is used and
 * no guest cookie is issued. Otherwise reads the existing `bc_guest` cookie,
 * or mints and sets a new one — so a returning visitor in the same browser
 * keeps the same guest identity across sessions.
 *
 * Only callable from a context where `next/headers`'s `cookies()` is
 * writable: Route Handlers and Server Actions, not plain Server Components.
 */
export async function resolveRequestIdentity(): Promise<RequestIdentity> {
  const user = await getSupabaseSessionUser(true);
  if (user) {
    return { userId: user.id, guestId: null, user };
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE)?.value;
  if (existing) {
    return { userId: null, guestId: existing, user: null };
  }

  const guestId = randomUUID();
  cookieStore.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return { userId: null, guestId, user: null };
}

/**
 * Read-only variant for Server Components (where `cookies()` can't be
 * mutated). Returns `null` guestId if none has been issued yet instead of
 * minting one — the next booking or API call will do that.
 */
export async function readRequestIdentity(): Promise<RequestIdentity> {
  const user = await getSupabaseSessionUser(false);
  if (user) {
    return { userId: user.id, guestId: null, user };
  }

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_COOKIE)?.value ?? null;
  return { userId: null, guestId, user: null };
}
