# Skill orchestration log

This log says only what was actually done. A skill listed as "not invoked" was not used, even if similar work was done by hand.

## 2026-09-21: recovery batch (hero, city grid, hydration, performance)

### Skills actually invoked
- **Impeccable:** `scripts/context.mjs` run once; `reference/audit.md`, `reference/new-work.md`, `reference/craft-floor.md` read; `scripts/detect.mjs` run over `src` (8 findings, all type-ramp or radius drift; none were slop patterns).
- **design-taste-frontend:** `SKILL.md` read in full. It has no reference files, so `anti-slop.md`, `motion.md`, `interaction-states.md`, `design-systems.md` and `pre-flight.md` **do not exist and were not used**. Its section 14 pre-flight matrix was applied by hand to the hero and the city grid.
- **redesign-existing-projects:** `SKILL.md` read in full. Used for the preserve / improve / remove / replace classification below.
- **full-output-enforcement:** `SKILL.md` read in full. Applied as a final scan for TODO, placeholder and dead-link patterns (0 TODO/FIXME in `src`).
- **systematic-debugging:** loaded for the hydration-mismatch investigation (reproduced first, root cause found, fixed once).
- **high-end-visual-design, industrial-brutalist-ui, stitch-design-taste:** `SKILL.md` opening sections read only. Not applied to the code.

### Not invoked as skills (work done directly, without the skill)
Code Reviewer, Architecture Designer, Spec Miner, Test Master, Playwright Expert, Security Reviewer, DevOps Engineer, The Fool, Next.js Developer, TypeScript Pro. Tests, measurements and the diff review were done by hand. **The Fool has not been run**; the protocol asks for it before release.

### Conflicts between skills and the project rules, and how they were resolved
| Skill advice | Project rule | Decision |
|---|---|---|
| `redesign-existing-projects`: "smooth scroll with inertia", "parallax card stacks", "true glassmorphism" | Native scroll, no parallax, no blur | Project rule wins. Those upgrade techniques were not used. |
| `high-end-visual-design`: ban Inter, ban Lucide, ban sticky navbars, "cinematic" motion | Calm, fast, practical | Not adopted. Inter and Lucide stay (one consistent family each). The sticky header stays because it is the navigation on every page. |
| `design-taste-frontend`: "not for dashboards, data tables, multi-step product UI" | Site includes booking and admin | Applied only to the public marketing surface (home). Admin was not restyled. |

### Preserve / improve / remove / replace (home)
| Element | Decision | Reason |
|---|---|---|
| 2.5D hero (layers, pointer parallax, dust canvas, streaks) | **Removed** | Measured stutter, no measured user benefit, forbidden by the project rules |
| Static hero photo, headline, two actions, search directly below | Preserve and simplify | It is the page's LCP and the primary action |
| City row (horizontal scroller, clipped last card) | **Replaced** by a wrapping grid | Ambiguous affordance, clipped card |
| Location picker, date and time pickers, two-ways section, trust list | Preserve | Working, measured, specific |
| Scroll reveal | Preserve, simplified | One IntersectionObserver, CSS transition only |

### Verification
- Type check: 0 errors. Lint: 0 errors, 1 warning. Unit: 574 passed. Browser: 40 passed (includes new hero, city-grid and time-zone hydration tests).
- Responsive: see `responsive-matrix.md`. Performance: see `performance-log.md`.

## 2026-09-21: P1 batch (contact, about, vehicle page, cars cards, titles, keys)

### Skills actually invoked
- **The Fool** (`fullstack-dev-skills:the-fool`): loaded and applied as a pre-mortem on the plan. Its interactive mode picker and wait-for-reply step were **skipped** because the owner asked for uninterrupted work. Changes it caused: Contact must say the chat is an AI and that no email or phone exists; hide the placeholder description instead of adding a specs line (it would repeat the spec strip); show local-currency price next to a city; verify translation keys before deleting.
- **Code Reviewer** (`fullstack-dev-skills:code-reviewer`): loaded and applied by hand to the diff. Finding fixed: a card could name a city where only a rate plan existed, with no active approved unit. Finding recorded (S12): price filter and sort still use the legacy USD price. No N+1 queries: two batched queries per card list, three after the fix, run in parallel where independent.

### Not invoked
Impeccable polish/harden, design-taste pre-flight, high-end-visual-design, full-output-enforcement were not re-run on this batch; only lint, types and tests were.

### Verification
Types 0 errors; lint 0 errors; unit 580 passed; browser 47 passed (new: contact, about, vehicle page overlap at 2 widths, placeholder hidden, card city).

## 2026-09-21 (afternoon): gap audit and fixes (12 of 14 audit units, then implementation)

### Scope
Everything in the recovery prompt that the morning batches had not covered: unaudited surfaces, security, delivery, dead code, completeness, test gaps, design gate reports, keyboard, reduced motion, zoom, landscape and console sweeps. Results are in `findings-register.md` and `design-gate-reviews.md`.

### Skills actually invoked (by isolated audit agents, each one reporting whether its skill really loaded)
- **fullstack-dev-skills:test-master and playwright-expert** (unit `test-gap`): loaded.
- **fullstack-dev-skills:security-reviewer** (units `security-api`, `security-auth-data`): loaded; its scanners (semgrep, gitleaks) were not run.
- **fullstack-dev-skills:devops-engineer** (unit `devops`): loaded; only the CI/CD and deployment parts apply to Vercel and GitHub Actions.
- **full-output-enforcement** (units `full-output-deadcode`, `full-output-states-docs`): loaded.
- **impeccable (audit and critique references) and redesign-existing-projects** (units `slop-auth-legal`, `slop-account-chrome`, `slop-checkout`): loaded. They did not run `context.mjs`, `detect.mjs` or the critique persistence step.
- **impeccable, design-taste-frontend, high-end-visual-design, industrial-brutalist-ui** (unit `design-vehicle-about-contact`): loaded and applied as lenses, in a degraded single-context run because impeccable's two-assessment rule needs sub-agents that agent did not have.
- Units `sweep-a` and `sweep-b` named no skill; they ran Playwright scripts.
- Every P0 or P1 finding then got a second agent told to refute it (45 second checks; none were refuted, six severities were lowered).

### Not invoked
- **Code Reviewer and Architecture Designer** on the shared systems (unit `architecture-tokens`), and the home and cars design review (unit `design-home-cars`): cut off by the session limit twice. The design review was done by hand from screenshots (lighter, skills not re-invoked). Token drift (S11) is still open apart from adding motion tokens.
- **The Fool, Spec Miner, TypeScript Pro, Next.js Developer, Legacy Modernizer, Stitch export, epic-design:** not run. The Fool has still not been run against the release.
- **A real screen-reader session:** not run.

### How the audit was run, and what went wrong
The first two attempts died on the account's session limit (8 agents at once, nothing saved). The third used a 3-wide worker pool with a circuit breaker and finished 10 of 14 units. Resuming it with the workflow tool's resume feature re-ran finished agents, because that cache only replays in the original order and a worker pool finishes in a different order each time; that run was stopped. The remaining units were re-launched by name, and the last two units hit the limit again. Lesson: with a worker pool, resume by passing the list of pending units, not by resuming the run.

### Changes made from the findings (all in commits f1ac62d, 589de39 and the one after)
Search and paging bugs, staff permission checks, currency and pick-up place on the booking path, auth screens, legal copy, translated titles, localized 404, cookie bar, chat panel, current-page markers, motion tokens and blur removal, delivery config, migration 0018, dead code removal, the font preload fix and the Zod CSP fix.

### Verification
- Types 0 errors; lint 0 errors (1 warning in generated coverage output); unit 606 passed; browser 89 passed (one language-menu test was a hydration race and passed 3 of 3 when re-run alone; it now waits for the page to settle).
- SQL tests: the new file `tests/sql/16_security_hardening.test.sql` and migration 0018 were **not run** (no PostgreSQL 16 on this machine); they run in CI.
- Responsive: 14 pages by 13 sizes, no overflow. Touch targets: only hidden 1x1 inputs remain. Admin: 12 pages at two widths, axe clean.
- Performance: see `performance-log.md`. Mobile target 95 not met (live 75–86).

## 2026-09-21 (night): The Fool, token review, portal translation stage 1

- **The Fool** (`fullstack-dev-skills:the-fool`): loaded and run in Find-the-failure-modes plus Attack-this modes. The interactive mode picker was skipped because the owner asked for it to run at once. Grounded in read-only checks (CI history through the public API, a CI-like local run, database counts, rate-limiter source). Result: `the-fool-release-review.md`. It found the CI failure (fixed) and the live weak admin credential (owner action).
- **Token review (impeccable `detect.mjs`):** run over `src`; 8 findings (type ramp, an email font and radii, one hex colour) all resolved: three font sizes moved onto the ramp, the email template's font stack and radii aligned and its hex palette documented in `DESIGN.md`, plus three unused tokens removed. The detector now reports nothing. Code Reviewer and Architecture Designer were still **not** invoked.
- **Portal translation, stage 1:** language negotiation for `/provider` in the proxy, a translation provider in the portal layout, the menu, shell and overview page in 11 languages. Verified by types, unit tests and a signed-out browser test only: no host test account exists, so the signed-in portal was **not** viewed. Stages 2 onward (bookings, fleet, payouts, pricing, reviews, disputes, team, settings, calendar) remain English.
