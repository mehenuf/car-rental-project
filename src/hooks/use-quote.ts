"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ExtraConfig, Quote } from "@/lib/pricing/types";

export interface QuoteParams {
  vehicleId: string;
  pickupBranchId?: number;
  dropoffBranchId?: number;
  pickupAt: string;
  dropoffAt: string;
  extras: { code: string; quantity: number }[];
  promoCode: string | null;
  driverAge: number | null;
}

export interface QuoteData {
  quote: Quote;
  token: string;
  expiresAt: string;
  availableExtras: ExtraConfig[];
}

export type QuoteState =
  | { status: "loading"; data: QuoteData | null }
  | { status: "ready"; data: QuoteData }
  | { status: "error"; data: QuoteData | null; message: string; unavailable: boolean };

class QuoteRequestError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
  }
}

interface Settled {
  /** The request this result answers. */
  key: string;
  refresh: number;
  /** The latest successful quote, kept while newer requests are in flight or fail. */
  data: QuoteData | null;
  error: { message: string; unavailable: boolean } | null;
}

/**
 * Fetches a signed quote from POST /api/quote whenever the trip or its
 * options change (debounced). `stale` is true while the inputs have changed
 * but the new quote has not been requested yet, so callers can keep the
 * booking button disabled until the price on screen matches the inputs.
 *
 * Loading is derived (the last settled request no longer matches the current
 * one) rather than set, so state is only written when a response arrives.
 */
export function useQuote(params: QuoteParams | null) {
  const key = params ? JSON.stringify(params) : null;
  const debouncedKey = useDebouncedValue(key, 350);
  const [refreshCount, setRefreshCount] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!debouncedKey) return;
    const controller = new AbortController();
    const p = JSON.parse(debouncedKey) as QuoteParams;

    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        vehicle_id: p.vehicleId,
        pickup_branch_id: p.pickupBranchId,
        dropoff_branch_id: p.dropoffBranchId,
        pickup_at: p.pickupAt,
        dropoff_at: p.dropoffAt,
        extras: p.extras,
        promo_code: p.promoCode,
        driver_age: p.driverAge,
      }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new QuoteRequestError(body?.error?.message ?? "We could not price this trip.", res.status);
        }
        return body as { quote: Quote; token: string; expires_at: string; available_extras: ExtraConfig[] };
      })
      .then((body) => {
        setSettled({
          key: debouncedKey,
          refresh: refreshCount,
          data: {
            quote: body.quote,
            token: body.token,
            expiresAt: body.expires_at,
            availableExtras: body.available_extras,
          },
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const requestError = err instanceof QuoteRequestError ? err : null;
        setSettled((prev) => ({
          key: debouncedKey,
          refresh: refreshCount,
          data: prev?.data ?? null,
          error: {
            message: err instanceof Error ? err.message : "We could not price this trip.",
            unavailable: requestError?.httpStatus === 409,
          },
        }));
      });

    return () => controller.abort();
  }, [debouncedKey, refreshCount]);

  const refresh = useCallback(() => setRefreshCount((c) => c + 1), []);

  const isCurrent = settled !== null && settled.key === debouncedKey && settled.refresh === refreshCount;
  const data = settled?.data ?? null;
  const state: QuoteState = !isCurrent
    ? { status: "loading", data }
    : settled.error
      ? { status: "error", data, message: settled.error.message, unavailable: settled.error.unavailable }
      : { status: "ready", data: settled.data as QuoteData };

  return { state, stale: key !== debouncedKey, refresh };
}
