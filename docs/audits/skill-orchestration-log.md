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
