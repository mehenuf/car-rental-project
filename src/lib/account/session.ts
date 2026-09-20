import "server-only";
import type { User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/guest";

/** Guards an account route: the caller must be signed in. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser(true);
  if (!user) throw new ApiError(401, "Sign in to continue.");
  return user;
}
