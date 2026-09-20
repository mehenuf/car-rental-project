# Decisions and trade-offs

Short records of choices that are not obvious from the code. Newest first.

## Scripts are allowed inline in the CSP
Next.js emits small inline bootstrap scripts, and a nonce-only policy forces every page to render on demand, which gives up static pages and CDN caching for a moderate security gain here. Everything else in the policy is strict (`default-src 'self'`, no framing, no object, restricted connect and frame sources), subresource integrity is on, React escapes all rendered text, and JSON-LD is escaped. Revisit if the site starts rendering user-supplied HTML.

## Heavy animation code loads only where it helps
GSAP and Lenis are dynamic imports. The hero renders on the server as a still scene with CSS animation; pointer parallax and dust load after first paint on wide screens with a fine pointer and no reduced-motion request. Phones and reduced-motion visitors never download them. Scroll reveals use one IntersectionObserver and CSS transitions.

## The location picker searches our own branches
It needs no external service or key. The search sits behind `src/lib/location/places.ts`, so a hosted address search could replace it later. A first-time visitor's city is guessed from the hosting platform's edge headers, with no permission prompt.

## Availability is enforced by the database
Each physical car is a `fleet_units` row and every reservation is a time range. A Postgres exclusion constraint makes overlapping reservations on one car impossible, and `create_booking_atomic` retries the next free unit.

## Money is integer minor units
Only 0- and 2-decimal currencies are supported. Reports never mix currencies; approximate totals use manually entered exchange rates and are labelled as such.

## Booking status is set only by the server
The client cannot send a status or lead score. Only an authenticated staff route can change a status.

## Admin access is a server-only claim
Staff roles live in `platform_staff`; the legacy `role: "admin"` app-metadata claim can only be set with the service key. A second factor for staff is optional (`ADMIN_REQUIRE_MFA=true`).

## Sign-up works without an email sender
Accounts can sign in immediately unless `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, because a fresh Supabase project has no reliable mail delivery.

## Payments run through a provider layer with an append-only ledger
Stripe (test mode) and simulated local methods sit behind one interface; the ledger is double-entry and append-only, and payouts are simulated.
