// A cancelled booking leaves the "can cancel" list when the account page refreshes, which used to take the
// "Cancelled. 40.00 will be refunded." message with it. The outcome is kept in the tab's session storage for a
// few minutes so the cancelled booking can still show it.

export interface OutcomeStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREFIX = "bc_cancel_";
export const OUTCOME_TTL_MS = 10 * 60 * 1000;

interface Saved {
  message: string;
  at: number;
}

export function saveCancelOutcome(store: OutcomeStore | null, bookingId: string, message: string, now = Date.now()): void {
  if (!store) return;
  try {
    store.setItem(PREFIX + bookingId, JSON.stringify({ message, at: now } satisfies Saved));
  } catch {
    // Storage can be full or blocked; the message is a convenience, so losing it is fine.
  }
}

function load(store: OutcomeStore | null, bookingId: string): Saved | null {
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + bookingId);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    return typeof saved.message === "string" && typeof saved.at === "number" ? { message: saved.message, at: saved.at } : null;
  } catch {
    return null;
  }
}

export function readCancelOutcome(store: OutcomeStore | null, bookingId: string, now = Date.now()): string | null {
  const saved = load(store, bookingId);
  return saved && now - saved.at <= OUTCOME_TTL_MS ? saved.message : null;
}

/** How long ago the outcome was saved, so focus moves to it only right after the cancellation. */
export function cancelOutcomeAgeMs(store: OutcomeStore | null, bookingId: string, now = Date.now()): number | null {
  const saved = load(store, bookingId);
  return saved ? now - saved.at : null;
}

/** The tab's session storage, or null where it is missing or blocked (private windows, server render). */
export function sessionStore(): OutcomeStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
