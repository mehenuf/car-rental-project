# Pricing and Quote Engine Implementation Plan (sub-project 2)

> Compact plan. The design is fixed by `docs/superpowers/specs/2026-09-20-pricing-quote-engine-design.md` (approved 2026-09-20). Code lives in the commits, not here. Every task is test-first and ends with `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (and `npm run test:db` when SQL changes) green, then a commit.

**Goal:** Provider-owned pricing, a pure `quote()` engine, a signed quote token, an immutable price snapshot on each booking, and a booking panel that shows an itemised all-inclusive total.

**Branch:** `feature/marketplace-core` (builds on migrations 0001 to 0007).

## Tasks

1. **Money and days** (`src/lib/pricing/money.ts`, `days.ts`, `errors.ts`)
   - `CURRENCY_EXPONENTS` (0 or 2 decimals only), `currencyExponent`, `mulBp` (half-up, integer), `minorToMajor`, `majorToMinor`, `formatMinor`.
   - `billableDays(pickup, dropoff)`: ceil of 24h periods with a 59-minute grace, minimum 1. `daysBetween` in `date-range.ts` delegates to it.
   - `QuoteError(code, message)` extends `ApiError` (400) with a `code`.
2. **Engine: rental pricing** (`types.ts`, `engine.ts`): min/max days, per-day season and weekend rules in the branch time zone, weekly (7+) and monthly (28+) discounts, promo.
3. **Engine: extras, fees, taxes, totals**: mandatory and requested extras with caps and quantities, young-driver, one-way and pickup surcharge lines, exclusive and inclusive taxes by category, service fee, deposit, commission and payout split. Property-style invariants.
4. **Quote token** (`token.ts`): `hashQuoteInput`, `signQuoteToken`, `verifyQuoteToken` (HMAC-SHA256, 15 minutes, tamper and expiry tests).
5. **Migration 0008** (`migrations/0008_pricing.sql`, `tests/sql/06_pricing.test.sql`): config tables and RLS, `platform_settings`, `branches.pickup_surcharge_minor`, backfill of one rate plan per (vehicle, branch with units), new generated `days` rule, `bookings.price_snapshot`, `create_booking_atomic` with `p_price_snapshot`. Update the privilege check in `tests/sql/04_booking_engine.test.sql` for the new signature.
6. **Loader and quote service** (`src/lib/pricing/load-config.ts`, `service.ts`, DB types): `getQuote(input) -> { quote, token, availableExtras }`, availability check via `free_units`, currency and unsupported-currency errors.
7. **API**: `POST /api/quote`; `POST /api/bookings` accepts `extras`, `promo_code`, `driver_age`, `quote_token`, stores the snapshot, writes `total_amount` from the quote, returns `409` with a fresh quote on price drift. `createVehicle`/`updateVehicle` keep rate plans in step with `price_per_day`.
8. **UI**: booking panel fetches quotes (debounced), shows itemised lines, deposit, extras, promo code, driver age; sends the token; handles `409`. `formatMinor` for display.
9. **Seed, docs, rollout**: demo tax rules, extras, policies and a seasonal rate in `seed.ts`; README API notes; rollout runbook including `QUOTE_SIGNING_SECRET`.

## Test cases for the engine (hand-computed, USD, base 5000 per day)

- 3 days, no options: 15000. Friday 2030-03-01 10:00 UTC to Monday 10:00 with weekend uplift 2000 bp: 15000 + 2 x 1000 = 17000.
- Season on Saturday only at 8000: +3000 season, weekend uplift on 8000 (1600) and on Sunday 5000 (1000): total 20600.
- 7 days with 1000 bp weekly discount: 35000 - 3500 = 31500. 28 days with 2000 bp monthly: 140000 - 28000 = 112000.
- Promo 1000 bp on 15000 = -1500; fixed 2000; fixed larger than the rental caps at the rental amount; expired, wrong vehicle, below min days and unknown codes are `PROMO_INVALID`.
- Tax 2000 bp exclusive on rental 15000 = 3000, total 18000. Inclusive on 12000: tax 2000 shown as included, total stays 12000.
- Service fee 500 bp on subtotal 15000 = 750, total 15750. Commission 1500 bp = 2250, provider payout 12750, platform revenue 3000, and payout + platform = total.
- Deposit fixed 20000 or 5000 bp of subtotal (7500), never part of the total.
- `mulBp(5, 1000) = 1` (half-up), `mulBp(-5, 1000) = -1`, `mulBp(101, 1500) = 15`.
- Pickup 2030-03-01T20:00Z in Pacific/Auckland is Saturday, so the weekend uplift applies for a 1-day rental (6000 instead of 5000).

## Rollout runbook (production Supabase and Vercel)

Prerequisite: sub-project 1's migrations `0003` to `0006` are already applied and its code is deployed (see the runbook in `2026-09-19-marketplace-core-booking-engine.md`). `0008` does not depend on `0007`, so it can be applied before or after it.

1. Back up production and confirm the backup exists.
2. Rehearse on a copy or a Supabase branch: apply `0008`, then check `select count(*) from rate_plans` (one per vehicle and branch that has units), `select base_daily_minor from rate_plans limit 5` (equals `price_per_day * 100`), and that an existing booking's `days` did not change unexpectedly (`select count(*) from bookings where days <> greatest(1, floor(extract(epoch from dropoff_at - pickup_at) / 86400))` shows only rentals that cross the new 59 minute grace rule).
3. Generate a signing secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and add it to Vercel as `QUOTE_SIGNING_SECRET` for Production (and Preview). Redeploying is required for it to take effect.
4. Apply `0008` to production, then deploy the new code. There is no hard cutover: the new `p_price_snapshot` parameter of `create_booking_atomic` has a default, so the previous release keeps booking correctly against the migrated database (its bookings simply have no snapshot). The only immediate effect on the old release is the new billable-days rule.
5. Smoke test: open a vehicle page and confirm the itemised total appears, book it, and confirm `price_snapshot` is populated on the booking row. Book with a promo code and an extra.
6. Optional demo data: `npx tsx seed.ts` **wipes** vehicles, branches and bookings. Never run it against production data.
7. Rollback: redeploy the previous Vercel build; it keeps working against the migrated database for the reason in step 4. Bookings made by the new release keep their `price_snapshot`. Restoring the backup is only needed if `0008` itself must be undone.

## Known limitations

- Only 0 and 2 decimal currencies are supported until `bookings.total_amount` is widened.
- Tax rules are per country, chosen by the pickup branch; the platform service fee is not taxed.
- Promo redemption limits, after-hours fees and provider screens for editing prices are deferred (sub-projects 3 and 4).
- Listing cards still show the catalogue `price_per_day`; only the booking panel uses the engine.
- Provider policy amounts are assumed to be in the provider's default currency.
