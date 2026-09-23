"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { cancelOutcomeAgeMs, readCancelOutcome, sessionStore } from "@/lib/account/cancel-outcome";

const noop = () => () => {};
/** Focus moves to the outcome only when it was written a moment ago, not on a later visit to the page. */
const FRESH_MS = 10_000;

/**
 * Shows what the cancel button reported (refund amount and so on) on the booking after the page has refreshed and the
 * button is gone. Read after mount, because session storage does not exist on the server. Takes focus when it is fresh, so the
 * person who just pressed "Yes, cancel" is not left on nothing and a screen reader reads the outcome.
 */
export function CancelOutcome({ bookingId }: { bookingId: string }) {
  const message = useSyncExternalStore(
    noop,
    () => readCancelOutcome(sessionStore(), bookingId),
    () => null,
  );
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const age = cancelOutcomeAgeMs(sessionStore(), bookingId);
    if (message && age !== null && age < FRESH_MS) ref.current?.focus();
  }, [message, bookingId]);

  if (!message) return null;
  return (
    <p ref={ref} tabIndex={-1} role="status" className="max-w-56 text-xs text-muted-foreground outline-none sm:text-end">
      {message}
    </p>
  );
}
