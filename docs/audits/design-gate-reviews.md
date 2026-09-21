# Design gate reviews, 2026-09-21

The four review blocks the recovery prompt asks for: Impeccable review, Taste Skill review, High-End Visual Design review and the Industrial critique lens. Two scopes.

## 1. Vehicle detail, About and Contact

Produced by an isolated auditor that loaded the impeccable, design-taste-frontend, high-end-visual-design and industrial-brutalist-ui skills through the Skill tool and looked at screenshots at 390x844 and 1280x800 in dark and light. Its own limits are stated first. Its findings are VAC-1 to VAC-10 in findings-register.md; most are fixed (see the register for status). The "Post-fix verdict" below is the auditor's prediction, not a re-measurement.

**Method:** DEGRADED single-context run. No sub-agent tool was exposed, so impeccable's dual-assessment rule could not be met, and detect.mjs, the live overlay and persistence were skipped (read-only). I looked at 12 screenshots (3 pages x 390x844 and 1280x800, dark and light), scrolled captures, focus captures and DOM probes. Evidence is in the scratchpad folder design-vehicle-about-contact.

### Impeccable Review
- **Scope:** /en/cars/honda-civic, /en/about and /en/contact at 390x844 and 1280x800, dark (default) and light.
- **Verdict:** Needs revision. About and Contact are close to Ship-ready. The vehicle page carries four P1 issues on the booking path (VAC-1 to VAC-4).
- **AI-slop patterns:** None: no gradients, glass, glow, eyebrows, stock testimonials, fake numbers or hero effects. Copy is plain and honest. Small tells: the muted-grey paragraph "Choose when you need the car..." (VAC-10), and "Popular" shown as a category pill.
- **Hierarchy/composition:** Vehicle 1280x800: image and booking card start aligned, but the car name sits at the very bottom of the fold (y 697-733) and is covered by the cookie dialog (VAC-2). On mobile, price and CTA are missing from the first two screens (VAC-3). Heading sizes are inconsistent 18/18/24px (VAC-6). About and Contact hierarchy is clear, but Contact's three rows have equal weight (VAC-8).
- **Typography/color/spacing:** Sora headings with Inter body, gold accent used only for price and icons. Text contrast measured 5.9:1 to 18:1 in both themes. About's real content is 14px muted (VAC-8). Column widths and left edges differ between About, Contact and the header.
- **Interaction/motion:** ScrollReveal is honest: content is visible by default, hidden only below the fold, and it respects prefers-reduced-motion. Focus rings are visible (gold outline on Contact rows, ring on selects). One label per intent is broken (VAC-7).
- **Responsive/accessibility:** No horizontal overflow at 390 or 1280. Time values clip at 390/360 (VAC-1). About and Contact have no targets under 44px on a coarse pointer.
- **Missing states/edge cases:** Not verified: sold-out, empty reviews, long names, RTL. A review with stars only and no text shows as a lone star row.
- **Required fixes:** VAC-1 to VAC-4, then VAC-5 to VAC-10.
- **Post-fix verdict:** Ready for polish.

### Taste Skill Review
- **Brief inference:** Reading this as: booking-focused marketplace detail and info pages for renters on phones, trust-first, calm and fast, leaning toward the existing Tailwind v4 system (Sora/Inter, asphalt and gold).
- **Chosen design direction:** Keep the incumbent system. No redesign; refine hierarchy and states only.
- **DESIGN_VARIANCE:** 3. **MOTION_INTENSITY:** 2. **VISUAL_DENSITY:** 5 (trust-first preset: 3-4 / 2-3 / 4-5).
- **Anti-slop findings:** Clean. Em dash in the vehicle tab title (VAC-5); duplicate CTA labels (VAC-7).
- **Composition/visual rhythm:** Vehicle: gallery, title, specs, features, panel, reviews, similar, with mobile stacking in the right order except that the booking card is too far down. About and Contact are simple lists, which suits them.
- **Typography/spacing:** Only the inconsistent h2 scale (VAC-6) and 14px About body (VAC-8).
- **Color/contrast:** Pass. Light theme swaps gold for a darker amber on the total and keeps 5.9:1 or better.
- **Responsive behavior:** Layout collapses correctly; the booking card time selects do not (VAC-1).
- **Interaction states:** Focus visible, dialogs OK, targets 44px. Missing: sticky mobile CTA (VAC-3).
- **Motion:** Quiet fade-and-rise only, motivated (below-fold reveal), reduced-motion safe. Static, in line with MOTION 2.
- **Pre-flight result:** FAIL on: em dash in a visible string (tab title), duplicate CTA intent (Book/Rent, List my/your car), hero-adjacent overlay covering primary content (cookie dialog). PASS on: eyebrow count (0), no logo wall, no fake numbers or version footers, dark and light both defined, reduced motion, mobile collapse, real images, button and form contrast (measured 6:1 or better; 'Enter code' placeholder not measured), no decorative dots. Lucide and Inter are project commitments, so allowed.
- **Required refinements:** VAC-2, VAC-3, VAC-5, VAC-7.

### High-End Visual Design Review
- **Does this feel premium through precision rather than decoration?** Mostly yes: hairlines, restrained gold, no effects. Precision slips at the clipped time value and the stacked cookie dialog.
- **Is contrast sufficient?** Yes: every sampled text pair is 5.9:1 or better in both themes.
- **Is whitespace intentional?** On the vehicle page, yes. On About and Contact desktop, the wide empty side gutters and differing column widths read as unplanned rather than composed.
- **Is information still easy to scan?** Yes, apart from the place and price basis being absent (VAC-4).
- **Is the primary action obvious?** On desktop, yes (bright pill), but it sits below the fold. On mobile, no (VAC-3).
- **Did any effect create measurable cost or confusion?** ScrollReveal hides about 1,300px of Similar Vehicles on mobile until scroll and scales cards to 0.985, so hit areas measure 43px until revealed. No real cost. The fixed cookie dialog is the only element that costs users something.
- **What was removed to improve refinement?** The trip-hint paragraph, the repeated brand line, the second button verb, and two of three heading sizes.

### Industrial Critique Lens
- **Is hierarchy obvious without decorative effects?** Yes: h1, hairline rows and price weight carry the structure. Contact is the clearest example.
- **Are typography and grid structure strong enough to stand alone?** Yes on Contact and About. On the vehicle page, sizes are inconsistent across sections (VAC-6).
- **Is information architecture direct and honest?** Contact is exemplary (it says there is no email or phone). About's label and h1 disagree (VAC-9). The vehicle page omits where the car is (VAC-4).
- **Are unnecessary wrappers, cards, pills or shadows hiding weak structure?** Mostly no. The 'Popular' pill (a category) and the round icon tiles on Contact are decoration; the bordered spec box adds little.
- **Is contrast sufficient for real usability?** Yes.
- **Which structural lessons can be adopted without the brutalist style?** Put facts in one line (place, price, dates) near the title. Use hairline rows with right-aligned figures for the price breakdown. One heading size per level. One label per action.

## 2. Home and Cars

Done by hand from screenshots (home full page at 1280 and 390, cars at 1280 and 390, dark theme) after the isolated auditor for this scope was cut off by the session limit twice. The four skills were **not** re-invoked for this block; it applies their criteria as I understand them and should be treated as a lighter review than section 1.

### Impeccable Review
- **Scope:** /en and /en/cars at 1280x800 and 390x844.
- **Verdict:** Ready for polish.
- **AI-slop patterns:** None of the usual ones: no gradient blobs, glass, glow, stat strip, logo wall or invented testimonials. The hero is a static photograph under a scrim. One earlier tell was fixed: the section headings mixed centred and left alignment.
- **Hierarchy/composition:** Home reads in a clear order: promise and two actions, search, two ways to use the site, cities, cars, how it works. The search bar overlaps the hero as intended. The cars page has filters left, results right, and the sort control top right.
- **Typography/color/spacing:** Sora headings and Inter body are consistent. Gold appears on the second line of the hero, section accents and the host card. The host card is the one large gold surface on the page.
- **Interaction/motion:** Cards lift on hover; a below-fold reveal runs once. No motion runs in the hero.
- **Responsive/accessibility:** No overflow from 320 to 1920 px, no target under 44 px on touch, axe clean.
- **Missing states/edge cases:** The deals grid shows six cars in a four-column grid, so the last row is half empty and a small "6 Cars" caption sits under it. Empty states for a place with no cars are covered on the cars page.
- **Required fixes:** none blocking. Consider a "See all cars" link in place of the caption.
- **Post-fix verdict:** Ready for polish.

### Taste Skill Review
- **Brief inference:** Reading this as: a two-sided marketplace landing and catalogue for renters first and hosts second, trust-first, calm and fast.
- **Chosen design direction:** Keep the incumbent asphalt and gold system; no redesign.
- **DESIGN_VARIANCE:** 5. **MOTION_INTENSITY:** 2. **VISUAL_DENSITY:** 4.
- **Anti-slop findings:** Clean apart from the alignment mix (fixed).
- **Composition/visual rhythm:** Alternating full-width and card sections; the city grid and car grid share the same gutter.
- **Typography/spacing:** Consistent scale; left-aligned headings after the fix.
- **Color/contrast:** Text and controls at 4.5:1 or better in both themes (axe).
- **Responsive behavior:** Verified by the 14-page width sweep.
- **Interaction states:** Focus, hover and pressed states exist on links and buttons; disabled states on the booking panel.
- **Motion:** Native scroll; CSS reveal; tokens in globals.css.
- **Pre-flight result:** Pass, with two open notes: the home page still repeats one action verb pair (Rent Now on cards, Book Now on the vehicle page), and the deals caption.
- **Required refinements:** None blocking.

### High-End Visual Design Review
- **Does this feel premium through precision rather than decoration?** Yes on the cars page (hairline cards, one accent). The home page leans on photography for atmosphere, which is fine.
- **Is contrast sufficient?** Yes.
- **Is whitespace intentional?** Yes.
- **Is information still easy to scan?** Yes; each car card shows name, city, rating and the price in the branch currency.
- **Is the primary action obvious?** Yes: Find a car in the hero, Search in the bar, Rent Now on cards.
- **Did any effect create measurable cost or confusion?** The two backdrop blurs on dialog and sheet overlays were the last blur effects and were removed.
- **What was removed to improve refinement?** Centred headings on two sections, and the dialog blur.

### Industrial Critique Lens
- **Is hierarchy obvious without decorative effects?** Yes.
- **Are typography and grid structure strong enough to stand alone?** Yes.
- **Is information architecture direct and honest?** Yes; the hero says where cars are available, taken from the database.
- **Are unnecessary wrappers, cards, pills or shadows hiding weak structure?** The three-image collage inside the "Find the right car" card is decorative but shows real cars.
- **Is contrast sufficient for real usability?** Yes.
- **Which structural lessons can be adopted without the brutalist style?** One caption or link under a grid, not both; keep a single large accent surface per page.
