# BestCar Marketplace Platform — Design Spec

Date: 2026-09-19
Status: Draft for review
Scope: Roadmap for the whole transformation, and the detailed design of sub-projects 1–2 plus the provider/payout model that sub-projects 3–4 build on.

## 1. Goals and decisions

BestCar today is an assessment-grade single-company rental site (Next.js 16, Supabase, Zod, AI chat lead scoring, admin dashboard). The goal is an enterprise-grade **multi-provider car rental marketplace**.

Decisions confirmed with the product owner:

| Decision | Choice |
|---|---|
| Business model | Marketplace: many independent rental providers per country, each with multiple branches; private individuals can list a personal car for owner-chosen time windows |
| Markets | Multi-country, multi-currency |
| Delivery target | Production-ready live portfolio/showcase. Payments and compliance are simulated, but built to real-money standards with test payment methods (Stripe test mode plus simulated local and international methods). Legal, tax and payment regulation are designed in |
| Money flow | Platform collects the payment, keeps a commission, pays out providers (Stripe Connect model, simulated) |

Market research takeaways (Which?, Consumer Reports 2026, FTC fee rule, California AB 1374): the all-inclusive headline price is the biggest trust factor. Also expected: live availability with no double-booking, seasonal rate plans, extras and promotions, deposits and pre-authorisation, free-cancellation windows, and self-service modify and cancel.

## 2. Roadmap (dependency order; each item gets its own spec, plan and build)

1. Marketplace data model and booking engine
2. Pricing and quote engine
3. Payments, ledger and payouts
4. Provider onboarding and portal (including individual-owner flow)
5. Customer account and trust (verification, licence upload, self-service changes)
6. Communications (email and SMS event pipeline)
7. Reviews, disputes and trust and safety
8. Platform admin and operations (roles, audit log, exports, financial reports)
9. Hardening, compliance and localisation (tests, CI, monitoring, GDPR and consent, SEO, multi-language)

## 3. Data model and availability (sub-project 1)

**Availability is enforced by the database, not app code.** The `stock` counter and `decrement_vehicle_stock` RPCs are removed.

- `providers`: tenant root. Type (`company` | `individual`), legal name, country, default currency, status, optional commission override.
- `provider_members`: staff of a provider. Roles `owner`, `manager` (branch-scoped), `agent`. Platform staff use a separate `platform_admin` role.
- `branches`: replaces `locations`. Belongs to a provider. Code, address, opening hours, timezone, currency, turnaround buffer, `is_active`. An individual owner has one implicit branch, with the exact address revealed only after booking.
- `vehicles`: remains the model catalogue, so slugs and site URLs are unchanged.
- `fleet_units`: one row per physical car. Model, branch, plate, VIN, mileage, status (`active` | `maintenance` | `retired`).
- `availability_windows`: for individual-owned units, the ranges in which the unit may be booked (opt-in). Owners choose instant-book or approve-first.
- `unit_occupancy`: one row per time range a unit is taken. `reason` is `booking`, `maintenance`, `transfer` or `owner_block`. A Postgres exclusion constraint on `(fleet_unit_id, tstzrange(start, end + branch buffer))` makes overlaps impossible.
- Availability query: a model is available at a branch for a range if some `active` unit there has no overlapping occupancy and (for individuals) the range lies inside an availability window. Booking claims a specific unit, and the constraint arbitrates races.
- One-way rentals: a booking has a pickup and a drop-off branch. Occupancy runs to the return and the unit transfers to the drop-off branch.
- Booking states: `pending → confirmed → active → completed`, with `cancelled` and `no_show` as side exits. Transitions are enforced in a single function. Existing `success` maps to `confirmed`.
- Row-level security: every provider-scoped table carries `provider_id`. Providers can only read and write their own rows, and public reads are limited to approved and published listings.
- Migration: each vehicle's `stock` of N becomes N `fleet_units` at its current location under a default seeded provider. Placeholder plates are generated. Existing bookings are kept.

**Currency.** Prices are defined per branch currency. There is no live FX conversion. Customers see the branch currency, and the site may show an approximate conversion for browsing only.

## 4. Pricing and quote engine (sub-project 2)

Provider-owned configuration (all with `provider_id`, currency from the branch):

- `rate_plans`: base daily rate, weekend uplift, seasonal overrides, weekly and monthly discount tiers, min and max days, included km per day and per-km overage. Companies price per model and branch, individuals price their one car.
- `extras`: provider-defined (child seat, GPS, extra driver, insurance tiers). Per day or per rental, with a cap and a maximum quantity.
- `provider_policies`: deposit (fixed or percent), tiered cancellation, fuel and mileage rules, minimum driver age, young-driver fee.
- `branch_fees`: one-way fee per branch pair, airport surcharge, after-hours pickup fee.
- `tax_rules`: per country or branch. Name, rate, what it applies to, inclusive or exclusive.
- `promo_codes`: platform or provider issued, percentage or fixed, with date, provider and vehicle constraints.
- `platform_fee_rules`: commission taken from the provider side, plus an optional visible customer service fee.

**Engine.** `quote(input, config) → Quote` is a pure function with no I/O. A separate loader gathers config.

- Input: vehicle, pickup and drop-off branch and time, extras, promo, driver age, customer country.
- Output: typed line items (base, weekend, season, discount, extra, fee, tax, service fee, promo), subtotal, tax total, grand total, deposit (a hold, shown separately), provider payout, platform revenue, snapshot of the applicable cancellation policy, expiry.
- Money is integer minor units with per-currency exponents (JPY 0, KWD 3). No floats. Deterministic rounding per line.
- The headline price is all-inclusive. Every mandatory fee and tax is in the total, and the deposit is shown beside it as a refundable hold.
- The quote is returned with an HMAC-signed token valid for 15 minutes. At booking the server re-quotes and compares. If config changed, it returns `409` with the new quote and never silently changes the price.
- The accepted quote is stored on the booking as an immutable `price_snapshot`. Refunds and payouts compute from it.
- Search results ("from X/day") use the same engine as checkout.
- The provider is merchant of record for rental tax. The platform taxes only its own service fee. The commission is deducted from the provider side by default.
- Testing: table-driven unit tests per rule, plus property tests (totals equal the sum of lines, payout plus platform revenue equals the total less tax).

## 5. Providers, individual owners and payouts (sub-projects 3–4)

**Onboarding (simulated, real states).** `draft → submitted → under_review → approved`, with `rejected` and `suspended` as side exits.

- Companies submit business name, registration number, licence document and payout account.
- Individuals submit ID, driver's licence, and per-car registration and insurance documents. Each listing is approved separately.
- Documents go to private storage. A platform-admin review queue approves or rejects with reasons. Providers cannot publish listings or receive payouts until approved.

**Individual-owner listings.** An owner sets availability windows on a calendar, chooses instant-book or approve-first, and sets their own price, rules and cancellation tier.

**Payout flow.**
1. The customer pays the total and the platform holds the funds and the deposit.
2. Booking completes with a return check-in (photos, fuel, mileage) and a short dispute window.
3. A `payout` is created for the provider share from the quote snapshot. Providers see pending and paid amounts and statements.
4. Cancellations and refunds follow the snapshot's policy, adjusting the provider share and the commission.
5. Every money movement writes to an append-only double-entry `ledger` (customer, platform, provider, tax). Reconciliation and reports read from it.

Payments use a provider abstraction with Stripe test mode plus simulated local and international methods, so real providers can replace the simulations without changing callers.

**Trust and safety.** Two-way reviews unlock after completion. Either side can open a dispute (damage, no-show, cleanliness), which freezes the payout and deposit until a platform admin resolves it. Individual owners must make an insurance declaration and get a listing verification badge.

## 6. Cross-cutting requirements

- Every API input is validated with Zod, as today. Provider-scoped access is enforced in RLS and again in route handlers.
- Money handling follows section 4 everywhere: integer minor units and no floats.
- Compliance is designed in: tax lines on invoices, consent records, data export and delete, and an audit log for admin and money actions.
- Next.js 16 has breaking changes from earlier versions. Before implementing, read the relevant guide in `node_modules/next/dist/docs/` as instructed in `AGENTS.md`.

## 7. Out of scope for this spec

Detailed designs for sub-projects 3–9 (each gets its own spec), live FX conversion, real KYC or payment provider onboarding, real tax filing, and native mobile apps.

## 8. Open items for sub-project specs

Concrete provider abstraction interface, the ledger account chart, per-country tax rule seeds, the dispute state machine, and the search and ranking design across providers.
