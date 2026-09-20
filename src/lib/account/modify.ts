import type { CancellationTier } from "@/lib/pricing/types";

const HOUR_MS = 3_600_000;

/** The last moment a customer may change a booking: the free-cancellation deadline, or null when there is none. */
export function modificationDeadline(pickupAt: Date, tiers: CancellationTier[]): Date | null {
  const free = tiers.filter((t) => t.refundBp >= 10000);
  if (free.length === 0) return null;
  const tightest = Math.min(...free.map((t) => t.hoursBefore));
  return new Date(pickupAt.getTime() - tightest * HOUR_MS);
}

export type ModifyCheck =
  | { ok: true }
  | { ok: false; reason: "not_modifiable" | "no_free_window" | "deadline_passed" };

export function canModify(now: Date, pickupAt: Date, tiers: CancellationTier[], status: string): ModifyCheck {
  if (status !== "confirmed") return { ok: false, reason: "not_modifiable" };
  const deadline = modificationDeadline(pickupAt, tiers);
  if (!deadline) return { ok: false, reason: "no_free_window" };
  if (now.getTime() > deadline.getTime()) return { ok: false, reason: "deadline_passed" };
  return { ok: true };
}

export type Settlement = { kind: "supplement" | "refund" | "none"; amountMinor: number };

/** A higher new total is collected as a supplement; a lower one is refunded. */
export function settleDelta(oldTotalMinor: number, newTotalMinor: number): Settlement {
  const delta = newTotalMinor - oldTotalMinor;
  if (delta > 0) return { kind: "supplement", amountMinor: delta };
  if (delta < 0) return { kind: "refund", amountMinor: -delta };
  return { kind: "none", amountMinor: 0 };
}
