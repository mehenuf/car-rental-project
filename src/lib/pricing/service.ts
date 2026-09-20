import "server-only";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { quote as computeQuote } from "@/lib/pricing/engine";
import { PriceChangedError } from "@/lib/pricing/errors";
import { loadQuoteConfig } from "@/lib/pricing/load-config";
import { hashQuoteInput, signQuoteToken, verifyQuoteToken } from "@/lib/pricing/token";
import type { ExtraConfig, Quote, QuoteConfig, QuoteInput } from "@/lib/pricing/types";
import { quoteSigningSecret } from "@/lib/secrets";
import { supabaseAdmin } from "@/lib/supabase-server";

export interface QuoteRequest {
  vehicleId: string;
  pickupBranchId: number | null;
  dropoffBranchId: number | null;
  pickupAt: Date;
  dropoffAt: Date;
  extras: { code: string; quantity: number }[];
  promoCode: string | null;
  driverAge: number | null;
}

export interface BuiltQuote {
  quote: Quote;
  input: QuoteInput;
  config: QuoteConfig;
}

function quoteSecret(): string {
  return quoteSigningSecret();
}

/** Explicit branch, else the vehicle's home branch, else the branch of its first active unit. */
async function resolvePickupBranchId(vehicleId: string, requested: number | null): Promise<number> {
  if (requested) return requested;

  const { data: vehicle, error } = await supabaseAdmin
    .from("vehicles")
    .select("location_id")
    .eq("id", vehicleId)
    .maybeSingle();
  if (error) throw new Error(`resolvePickupBranchId: ${error.message}`);
  if (!vehicle) throw new NotFoundError(`Vehicle ${vehicleId} not found`);
  if (vehicle.location_id) return vehicle.location_id;

  const { data: unit, error: unitError } = await supabaseAdmin
    .from("fleet_units")
    .select("branch_id")
    .eq("vehicle_id", vehicleId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (unitError) throw new Error(`resolvePickupBranchId: ${unitError.message}`);
  if (!unit) throw new ConflictError("This vehicle is no longer available for booking.");
  return unit.branch_id;
}

/** Loads the trip's configuration and prices it. Optionally proves a unit is free first. */
export async function buildQuote(
  request: QuoteRequest,
  opts: { requireAvailability?: boolean } = {}
): Promise<BuiltQuote> {
  const pickupBranchId = await resolvePickupBranchId(request.vehicleId, request.pickupBranchId);
  const dropoffBranchId = request.dropoffBranchId ?? pickupBranchId;

  const input: QuoteInput = {
    vehicleId: request.vehicleId,
    pickupAt: request.pickupAt,
    dropoffAt: request.dropoffAt,
    pickupBranchId,
    dropoffBranchId,
    extras: request.extras,
    promoCode: request.promoCode,
    driverAge: request.driverAge,
  };

  const config = await loadQuoteConfig({
    vehicleId: input.vehicleId,
    pickupBranchId,
    dropoffBranchId,
    promoCode: input.promoCode,
  });

  if (opts.requireAvailability) {
    // Unpaid bookings past their hold no longer block a car: free them before searching.
    const { error: sweepError } = await supabaseAdmin.rpc("expire_stale_holds");
    if (sweepError) throw new Error(`buildQuote: ${sweepError.message}`);

    const { data, error } = await supabaseAdmin.rpc("free_units", {
      p_vehicle_id: input.vehicleId,
      p_pickup_branch_id: pickupBranchId,
      p_dropoff_branch_id: dropoffBranchId,
      p_start: input.pickupAt.toISOString(),
      p_end: input.dropoffAt.toISOString(),
    });
    if (error) throw new Error(`buildQuote: ${error.message}`);
    if (!data || data.length === 0) {
      throw new ConflictError("This vehicle is no longer available for the selected dates.");
    }
  }

  return { quote: computeQuote(input, config), input, config };
}

export interface SignedQuote extends BuiltQuote {
  token: string;
  expiresAt: Date;
  availableExtras: ExtraConfig[];
}

/** A quote for the booking panel: available, priced, and signed for 15 minutes. */
export async function getSignedQuote(request: QuoteRequest): Promise<SignedQuote> {
  const built = await buildQuote(request, { requireAvailability: true });
  const { token, expiresAt } = signQuoteToken(
    { inputHash: hashQuoteInput(built.input), totalMinor: built.quote.totalMinor, currency: built.quote.currency },
    quoteSecret()
  );
  return { ...built, token, expiresAt, availableExtras: built.config.extras };
}

/**
 * The quote a booking is made at. It is always computed fresh on the server;
 * the client never supplies a price. If the client presents a token, the
 * price it saw must still be the live price, otherwise `PriceChangedError`
 * carries the new quote back so nothing changes silently.
 */
export async function quoteForBooking(request: QuoteRequest, token: string | null): Promise<BuiltQuote> {
  const built = await buildQuote(request);
  if (token) {
    const verified = verifyQuoteToken(token, quoteSecret());
    if (verified.inputHash !== hashQuoteInput(built.input)) {
      throw new ApiError(400, "This quote does not match the booking request.");
    }
    if (verified.totalMinor !== built.quote.totalMinor || verified.currency !== built.quote.currency) {
      throw new PriceChangedError(built.quote);
    }
  }
  return built;
}
