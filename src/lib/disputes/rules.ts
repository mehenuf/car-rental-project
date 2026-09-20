import { z } from "zod";

export const DISPUTE_TYPES = ["damage", "cleanliness_or_fees", "listing_mismatch", "overcharge", "service_problem"] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];
export type Side = "customer" | "provider";
export type DisputeStatus = "awaiting_response" | "negotiating" | "agreed" | "escalated" | "resolved" | "dismissed";

const HOUR_MS = 3_600_000;
export const DISPUTE_WINDOW_HOURS = 48;
export const DISPUTE_DEADLINE_HOURS = 72;
export const MAX_OFFERS = 5;

export function typesFor(side: Side): DisputeType[] {
  return side === "provider" ? ["damage", "cleanliness_or_fees"] : ["listing_mismatch", "overcharge", "service_problem"];
}

export function disputeWindowEnds(completedAt: Date): Date {
  return new Date(completedAt.getTime() + DISPUTE_WINDOW_HOURS * HOUR_MS);
}

export function disputeDeadline(from: Date): Date {
  return new Date(from.getTime() + DISPUTE_DEADLINE_HOURS * HOUR_MS);
}

export type OpenCheck = { ok: true } | { ok: false; reason: "not_completed" | "window_closed" | "already_open" };

export function canOpenDispute(input: { status: string; completedAt: Date | null; now: Date; hasOpenDispute: boolean }): OpenCheck {
  if (input.status !== "completed" || !input.completedAt) return { ok: false, reason: "not_completed" };
  if (input.hasOpenDispute) return { ok: false, reason: "already_open" };
  if (input.now.getTime() > disputeWindowEnds(input.completedAt).getTime()) return { ok: false, reason: "window_closed" };
  return { ok: true };
}

export type Action = "message" | "evidence" | "accept" | "counter" | "contest";

/** Mirrors `respond_dispute`: messages are open to both sides; offers only to the side that did not make the last one. */
export function canRespond(input: {
  status: DisputeStatus;
  side: Side;
  action: Action;
  offerBySide: Side | null;
  offerCount: number;
}): boolean {
  if (["agreed", "resolved", "dismissed"].includes(input.status)) return false;
  if (input.action === "message" || input.action === "evidence") return true;
  if (input.offerBySide === input.side) return false;
  if (input.action === "counter" && input.offerCount >= MAX_OFFERS) return false;
  return true;
}

/** Provider claims are settled from the deposit; renter complaints are refunded from the provider's share. */
export function nextResolution(type: DisputeType): "capture" | "refund" {
  return type === "damage" || type === "cleanliness_or_fees" ? "capture" : "refund";
}

const id = z.string().uuid();

export const OpenDisputeSchema = z
  .object({
    booking_id: id,
    type: z.enum(DISPUTE_TYPES),
    body: z.string().trim().min(1).max(2000),
    claimed_amount_minor: z.coerce.number().int().positive().optional(),
    photo_paths: z.array(z.string().min(1).max(300)).max(10).default([]),
  })
  .refine((v) => !["damage", "cleanliness_or_fees"].includes(v.type) || v.claimed_amount_minor !== undefined, {
    message: "State the amount you are claiming",
    path: ["claimed_amount_minor"],
  });

export const RespondDisputeSchema = z
  .object({
    action: z.enum(["message", "evidence", "accept", "counter", "contest"]),
    body: z.string().trim().max(2000).optional(),
    amount_minor: z.coerce.number().int().min(0).optional(),
    photo_paths: z.array(z.string().min(1).max(300)).max(10).default([]),
  })
  .refine((v) => v.action !== "counter" || v.amount_minor !== undefined, { message: "Say what you offer", path: ["amount_minor"] })
  .refine((v) => !["message", "evidence", "contest"].includes(v.action) || Boolean(v.body) || v.photo_paths.length > 0, {
    message: "Write something first",
    path: ["body"],
  });

export const DecideDisputeSchema = z.object({
  resolution: z.enum(["capture", "refund", "dismiss"]),
  amount_minor: z.coerce.number().int().positive().optional(),
  note: z.string().trim().min(1).max(1000),
});
