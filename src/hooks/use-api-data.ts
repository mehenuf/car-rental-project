"use client";

import { useEffect, useState } from "react";

interface ApiErrorBody {
  error?: { message?: string };
}

/**
 * A discriminated union instead of three independently-optional fields —
 * `{ isLoading: false, data: null, error: null }` used to be a real,
 * silently-reachable state (a fetch failure left `data` null forever while
 * `isLoading` had already flipped false), which read as "stuck loading" in
 * any consumer that gated its skeleton on `isLoading || !data`. Narrowing
 * on `status` is the only way to read `data`/`error`, so a consumer that
 * doesn't handle the error case distinctly fails to type-check instead of
 * silently mis-rendering it.
 */
export type UseApiDataResult<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "success"; data: T; error: null };

/**
 * Fetches `url` and re-fetches whenever the URL string changes — so a
 * "refresh" action just needs to change the URL (e.g. append `&_r=<n>`)
 * rather than this hook needing its own extra dependency list.
 */
export function useApiData<T>(url: string | null): UseApiDataResult<T> {
  const [result, setResult] = useState<UseApiDataResult<T>>({
    status: "loading",
    data: null,
    error: null,
  });

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
        if (!cancelled) setResult({ status: "success", data: body as T, error: null });
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Request failed";
          setResult({ status: "error", data: null, error: message });
        }
      }
    }

    // Resetting synchronously here (not inside a callback) is intentional:
    // `url` is the fetch's request key, so the result must flip back to
    // "loading" before `run()`'s first await — otherwise stale data for
    // the *previous* key would stay visible while the new request is
    // still in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult({ status: "loading", data: null, error: null });
    run();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return result;
}
