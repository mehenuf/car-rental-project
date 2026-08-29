"use client";

import { useEffect, useState } from "react";

interface ApiErrorBody {
  error?: { message?: string };
}

export interface UseApiDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches `url` and re-fetches whenever the URL string changes — so a
 * "refresh" action just needs to change the URL (e.g. append `&_r=<n>`)
 * rather than this hook needing its own extra dependency list.
 */
export function useApiData<T>(url: string | null): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(url !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(url as string);
        const body = (await res.json()) as unknown;
        if (!res.ok) {
          const message = (body as ApiErrorBody)?.error?.message ?? "Request failed";
          throw new Error(message);
        }
        if (!cancelled) {
          setData(body as T);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Resetting synchronously here (not inside a callback) is intentional:
    // `url` is the fetch's request key, so loading/data must flip before
    // `run()`'s first await — otherwise stale data for the *previous* key
    // would stay visible (or a stale "loaded" state would flash) while the
    // new request is still in flight. Every consumer already gates on
    // `isLoading` before reading `data`, so clearing it here is safe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setData(null);
    run();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, isLoading, error };
}
