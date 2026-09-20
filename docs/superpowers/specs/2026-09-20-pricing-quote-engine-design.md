# Pricing and Quote Engine — Design Spec (sub-project 2)

Date: 2026-09-20
Status: Draft for review
Parent: `2026-09-19-marketplace-platform-design.md` section 4. This spec turns that section into concrete decisions. Section 4 stays the source for anything not repeated here.
Builds on: sub-project 1 (branches, fleet units, `create_booking_atomic`), merged on branch `feature/marketplace-core`.

## 1. Scope

**In:** provider-owned pricing configuration tables, a pure `quote()` function, a server-side config loader, `POST /api/quote`, a signed 15-minute quote token, an immutable `price_snapshot` on every booking, booking-panel UI showing an itemised all-inclusive total with extras and a promo code, backfill so every existing vehicle keeps its current price.

**Out (each with the sub-project that owns it):**
- Provider UI to edit rate plans, extras, policies (4). Until then configuration is written by seed and SQL.
- Charging money, deposit holds, refunds, invoices (3). This sub-project only computes the deposit and stores the cancellation policy.
- Promo redemption limits and per-customer limits (3, once bookings are paid).
- After-hours pickup fee (needs opening-hours parsing; later).
- Live FX conversion, multi-currency dashboards, currencies with 3 decimals such as KWD (see decision 3).
- "From X/day" on listing cards computed by the engine. Cards keep showing the catalogue `price_per_day`, which is backfilled equal to the base rate. Moving cards onto the engine is a follow-up.

## 2. Decisions to confirm

1. **Billable days.** Whole 24-hour periods rounded up, with a 59-minute grace period: a 24h30m rental is 1 day, 25h05m is 2 days, minimum 1. The current `bookings.days` column and the site preview floor instead, so a 25-hour rental is charged one day today. Migration 0008 changes the generated `days` column to the new rule, and one shared `billableDays()` function is used by the engine, the site preview and the tests.
2. **Money is integer minor units** in the engine and in `price_snapshot`. `bookings.total_amount` stays a `numeric(10,2)` in major units (the dashboard views read it), written as `total_minor / 10^exponent`. Because of that column, v1 supports only currencies with 0 or 2 decimals (USD, EUR, GBP, AED, CAD, AUD, JPY and similar). 3-decimal currencies (KWD, BHD) are rejected with a clear error until the column is widened.
3. **Prices belong to (vehicle, branch), not to a unit.** One active rate plan per vehicle per branch. A private owner has one branch and therefore one plan. The unit that gets assigned at booking does not change the price.
4. **Weekend and season rules use the branch time zone.** The start of each billable day decides its date and weekday.
5. **Taxes** are chosen by the pickup branch country and may be exclusive (added on top) or inclusive (already inside prices, shown as an included line). Each rule taxes some of three categories: rental, extras, fees. The provider is merchant of record for these. The platform customer service fee is not taxed in v1.
6. **Platform commission** comes from the provider side: `providers.commission_rate_override` if set, else the platform default (15% at first). The optional customer service fee is a visible line.
7. **Quote token.** HMAC-SHA256 with a server secret (`QUOTE_SIGNING_SECRET`), valid 15 minutes, bound to a hash of the quote input and the quoted total. It is optional on `POST /api/bookings`: without it the server quotes fresh and books, as today. With it, the server re-quotes and returns `409` with the new quote if the total changed. The client never supplies a price.
8. **A quote also checks availability.** `POST /api/quote` returns `409` if no unit is free for the trip, so an unbookable trip is never quoted.
9. **Backfill.** Migration 0008 creates a rate plan per (vehicle, branch that has units) with `base_daily = round(price_per_day * 100)` in the branch currency, so behaviour is unchanged on day one.

## 3. Data model (migration 0008)

All provider-scoped tables carry `provider_id` and use the same RLS pattern as sub-project 1 (members read, owners and managers write).

- `rate_plans(id, provider_id, vehicle_id, branch_id, currency, base_daily_minor, weekend_uplift_bp, weekly_discount_bp, monthly_discount_bp, min_days, max_days, included_km_per_day, extra_km_minor)`, unique `(vehicle_id, branch_id)`. Weekly discount applies from 7 days, monthly from 28. Currency must equal the branch currency (enforced by the loader and a check trigger).
- `rate_seasons(id, rate_plan_id, provider_id, during daterange, daily_minor)`, no overlaps per plan. A season replaces the base daily rate for days inside it.
- `extras(id, provider_id, code, name, kind extra|insurance, pricing per_day|per_rental, unit_price_minor, max_quantity, cap_minor, is_mandatory, is_active)`, unique `(provider_id, code)`. `cap_minor` caps the per-unit total of a per-day extra.
- `provider_policies(provider_id, deposit_type fixed|percent, deposit_value, cancellation_tiers jsonb, min_driver_age, young_driver_age, young_driver_fee_minor)`. `cancellation_tiers` is `[{ "hours_before": 48, "refund_bp": 10000 }, ...]`.
- `one_way_fees(provider_id, from_branch_id, to_branch_id, amount_minor)`, unique per pair. `branches` gains `pickup_surcharge_minor` (airport-type surcharge).
- `tax_rules(id, country_code, name, rate_bp, applies_to text[], inclusive, is_active)`. Demo rules are seeded by `seed.ts`.
- `promo_codes(id, code unique case-insensitive, issuer platform|provider, provider_id, discount_type percent|fixed, value, currency, valid_during tstzrange, min_days, vehicle_id, is_active)`. Applies to the rental amount only.
- `platform_settings(singleton row: commission_bp, service_fee_bp)`.
- `bookings` gains `price_snapshot jsonb`. `create_booking_atomic` gains a `p_price_snapshot jsonb` parameter and stores it in the same transaction.

## 4. Engine (`src/lib/pricing/`, pure, no I/O)

`quote(input, config): Quote`. Line items, in order, all in minor units:

`base` (days x base daily), `season` (adjustment, can be negative), `weekend` (uplift), `duration_discount` (negative), `promo` (negative), `extra` per extra (mandatory ones added automatically), `young_driver`, `one_way`, `pickup_surcharge`, one `tax` line per applicable rule (`included: true` lines are informational), `service_fee`.

Output also carries: `subtotalMinor`, `taxMinor`, `totalMinor` (sum of non-included lines), `depositMinor` (separate hold, not in the total), `providerPayoutMinor`, `platformRevenueMinor`, `cancellationTiers`, `days`, `currency`.

Invariants tested with property-style tests: the total equals the sum of its non-included lines, and `providerPayout + platformRevenue == total`. Rounding is half-up per line using integer arithmetic (`mulBp`). Errors are typed (`QuoteError` with codes such as `MIN_DAYS`, `MAX_DAYS`, `UNKNOWN_EXTRA`, `EXTRA_QUANTITY`, `DRIVER_TOO_YOUNG`, `PROMO_INVALID`).

Payout split: `providerGross = total - serviceFee`; `commission = mulBp(rental + extras + fees excluding taxes, commissionBp)`; `providerPayout = providerGross - commission` (taxes stay with the provider, who remits them); `platformRevenue = commission + serviceFee`.

## 5. API and UI

- `POST /api/quote` (public, rate-limited like bookings): input `vehicle_id, pickup_branch_id?, dropoff_branch_id?, pickup_at, dropoff_at, extras?, promo_code?, driver_age?`. Output `{ quote, token, expires_at, available_extras }`.
- `POST /api/bookings` accepts optional `extras`, `promo_code`, `driver_age`, `quote_token`, computes its own quote, stores the snapshot, and writes `total_amount` from it.
- Booking panel: fetches a quote when dates or options change (debounced), shows itemised lines and the deposit, offers extras and a promo code, sends the token when booking, and shows the new price if the server returns `409`.

## 6. Testing and rollout

- Vitest: money, days, each line item, invariants, tax inclusive and exclusive, token tamper and expiry.
- SQL tests: new constraints, backfill, `days` rule, snapshot stored by the booking function.
- Loader and API are checked by hand against a staging Supabase (same checklist style as sub-project 1).
- Rollout: apply `0008` after the sub-project 1 migrations, set `QUOTE_SIGNING_SECRET` in Vercel before deploying, deploy, smoke test.
