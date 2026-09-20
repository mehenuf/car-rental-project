"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

/**
 * Client-side auth state, kept in sync via `onAuthStateChange` so the header updates immediately after login/logout
 * without a full reload. "Admin" is determined by `app_metadata.role`, which can only be set server-side with the
 * service role key, so a customer can never grant it to themselves.
 *
 * The auth library is about 60 KB, so it is loaded after the page is idle rather than with the first scripts; the
 * header shows its signed-out state until then, which is also what the server rendered.
 */
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      const { supabase } = await import("@/lib/supabase");
      if (cancelled) return;
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(data.user);
      setLoading(false);
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
      unsubscribe = () => subscription.unsubscribe();
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const handle = idle(() => void start());
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
      unsubscribe?.();
    };
  }, []);

  return { user, isAdmin: user?.app_metadata?.role === "admin", loading };
}
