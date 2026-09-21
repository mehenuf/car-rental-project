# The Fool: release review, 2026-09-21

Modes: **Find the failure modes** (pre-mortem with second-order chains) and **Attack this** (red team). The skill normally asks the owner to pick a mode; the owner asked for it to run at once with this pairing, so the interactive step was skipped and the "User response" section below is left for the owner to answer afterwards.

Evidence used, all read-only: the GitHub Actions run history through the public API, a local rebuild and browser run with the same placeholder database CI uses, counts from the live database (via the service key, no writes), the source of the rate limiters, and the measurements in `performance-log.md`.

## Steelmanned thesis

"BestCar is ready to be presented as a calm, fast, accessible, honest car-rental marketplace." In its strongest form: the hero is static and the site scrolls at 60 fps with no long tasks; live mobile Lighthouse is 78 to 91 and desktop 96 to 99; axe is clean on public and admin pages; 616 unit tests, 99 browser tests and 17 SQL test files exist; payments are labelled as simulated; the contact page admits there is no support line; legal pages match the product; RLS, a strict CSP, rate limits and audit records are in place; and 110 audit findings are written down with status rather than hidden.

## What holds up (conceded)
- The measured performance and smoothness claims are real and reproducible (`scripts/perf/*`).
- The SQL suite passes on PostgreSQL 16 in CI, including the new migration and its test.
- Honesty on the surface is real: simulated payments, no invented contact details, no invented testimonials.
- The riskiest code paths (search filter, staff permissions, currency display) now have tests.

## Failure narratives, ranked

### 1. The release that looks green is red
*It is 2 weeks from now. A reviewer opens the repository, sees a red cross on `main`, and opens the Actions tab: 12 of the last 30 runs failed and 8 were cancelled. The browser-test step fails on every recent commit.*

- **Evidence (Measured).** Public API: last success is commit `54e4b3a`; runs after it fail at "Run npx playwright test". Every other step, including `test:db`, was green. Reproduced locally with CI's placeholder database: 13 tests failed. Cause: tests guarded by "skip if the page is not 200" ran against an error page that still answers 200 when the database is unreachable.
- **Chain.** Red badge, so the reviewer distrusts the claim "tests pass", so they discount the audit documents that quote test counts, so the honest work looks like decoration.
- **Root assumption that was wrong.** "The local suite passing means CI passes." Local runs had a real database; CI does not, and I had no way to see CI from here.
- **Status.** Fixed in `9e69462` (shared `hasSampleData` check); CI-like run: 76 passed, 23 skipped, 0 failed. **Not yet confirmed on GitHub**; check the run for that commit.
- **Early warning.** A red badge; a failing step in the first two minutes of a push.

### 2. A weak password on a live super-admin account
*It is next month. The test admin login that was shared in a chat is used from an unfamiliar address. Staff can approve hosts, view licence photos and issue refunds, and MFA is off by default.*

- **Evidence (Observed).** The test admin account authenticated against the same Supabase project the live site uses (local runs read the same database). Its password is short and was pasted into a chat; `ADMIN_REQUIRE_MFA` is opt-in and not enabled.
- **Chain.** Login, then approve a fraudulent host and car, then a renter books a car that does not exist, then a dispute and a refund, then the audit log shows a real staff identity for every action, which makes it look like an insider incident.
- **Root assumption.** "A test credential is low risk because it is only for testing." It is a production credential.
- **Mitigation (do first).** Change that password now; turn on `ADMIN_REQUIRE_MFA` after enrolling staff; use a separate Supabase project for testing; never reuse a chat-shared password for anything live.

### 3. The database hole is fixed in the repository, open in production
*It is a week from now. A host whose company was approved opens the browser console, signs in, and sets one of their car rows to `approved`; the car goes live without staff review.*

- **Evidence (Observed, unproven live).** The policy that lets host members write `fleet_units` and default `listing_status = 'approved'` are in the live schema; migration `0018` closes it but has not been applied. Legacy analytics tables (`daily_stats`, two revenue views) remain readable by the API roles until then.
- **Bound.** The host must already be approved, so this is a bad-faith host, not an outsider. But the About page tells renters "staff approve each car before it appears", which this would falsify.
- **Chain.** One unreviewed listing, then a renter hurt or scammed, then the platform's stated safeguard is shown to be false.
- **Mitigation.** Apply `0018` (CI already ran it on PostgreSQL 16 and it passed); after applying, run the check query in `docs/GO-LIVE.md`; then try the "approve my own car" call as a test host to see it refused.

### 4. The trust claims sit on seeded data
*A renter or reviewer looks closely at "Reviews from real trips".*

- **Evidence (Measured).** The live database holds 24 cars, 207 bookings (144 completed) and 60 reviews. The rating on each card (3.4 to 4.5) equals the sum of real rows, so the code does not invent numbers, but the rows come from demo data, not customers.
- **Chain.** Someone recognises sample names, then reads the About page, then concludes the marketplace claims are staged.
- **Mitigation.** Say so: a small "sample data" note near ratings and city counts, or a flag on seeded rows that the UI can show. Keep the simulated-payments footer.

### 5. "Fast" is a range, not a number
*It is demo day. The first request after idle takes 2.3 seconds, and the presenter's own PageSpeed run shows 62.*

- **Evidence (Measured).** Warm first byte 0.38 to 0.66 s; cold 1.8 to 2.3 s; mobile Lighthouse 78 to 91 on live, 74 on one vehicle-page run; the function runs in Washington while the database region is unknown, at 250 to 960 ms per query. Hypothesis (unverified): a free-tier database project pauses after inactivity.
- **Mitigation.** Pin the function region beside the database; load the pages once before presenting; quote the measured range, not "95".

### 6. Accessibility and translation claims outrun their evidence
- **Evidence.** Automated checks (axe, tree, focus, keyboard sweep) cover a portion of WCAG; no screen-reader session has run. About 55 strings written this week in 10 languages have not been read by native speakers; legal pages are English-only; the host portal is English except its menu and overview.
- **Mitigation.** Label as "automated checks, screen-reader pass pending"; have one native reader per launch language skim the auth and booking screens.

## Red-team pass

| Persona | Vector | Evidence | Rank | Defense |
|---|---|---|---|---|
| Credential attacker | Reuse the shared admin password, no second factor | See failure 2 | Highest | Rotate, MFA, separate test project |
| Bad-faith host | Self-approve cars through the API | See failure 3 | High until `0018` is applied | Apply `0018`, then retest as a host |
| Inventory squatter | Guests can hold cars for 15 minutes without an account; the limit is 5 bookings a minute per address (`/api/bookings`), so a script with rotating addresses can hold a small fleet | Rate limiter source read; not attempted | Medium | Per-car and per-email hold caps; email confirmation before a second hold |
| Denial of wallet | The chat allows 10 requests a minute per address and has no daily budget, so a script can run up the AI bill | Source read; token and time caps added today | Medium | A global daily cap; alert on spend |
| Enumerator | Sign-up says whether an email already has an account | Audit SEC-API-8 | Low to medium | Same reply for both cases |
| Careless developer | Preview deployments can use the production keys | Audit DEVOPS-3 | Medium | Separate keys per Vercel environment |
| Regulator | Data leaves to third parties (AI chat, optional n8n) | Audit SEC-PRIV-007 | Low | Keep the privacy page current; sign webhooks |

## Inversion check
What would make this release clearly succeed? A green CI badge, a rotated admin password with MFA, `0018` applied and re-tested, sample data labelled, and a warmed, region-pinned site quoted as "78 to 91 on mobile, 96 to 99 on desktop". None of these is large; the risk is not building more, it is presenting before the last mile is done.

## User response (for the owner)
1. Is the shared test admin account also the real admin account for the live site? If yes, rotate it before anything else.
2. May `0018` be applied to production now, and is there a staging project to try it on first?
3. Do you want ratings and city counts labelled as sample data, or should the seed be replaced with clearly fictional names?
4. What is the Supabase region, so the function region can be pinned?

## Synthesis (provisional, until answered)
The position is defensible on performance, smoothness, surface honesty and test depth, and **not yet defensible on operations**: CI was red, a weak staff credential is live, and one database fix is unapplied. The order of work is: (1) confirm CI green, (2) rotate and secure the admin account, (3) apply and retest `0018`, (4) label sample data, (5) pin the region and warm the site, (6) run the screen-reader pass. A second pass in **Test the evidence** mode would be worth running after these, on the claims in the About and Contact pages.
