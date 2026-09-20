# AI-slop register

Severity: P0 blocks use, P1 damages trust or clarity, P2 polish. Status as of 2026-09-21.

| ID | Sev | Area | Finding (evidence) | Owner | Status |
|---|---|---|---|---|---|
| S1 | P0 | Motion | 2.5D hero: pointer parallax, dust canvas, animated streaks, tilt. 38 slow frames of 293 while scrolling home. | Impeccable / taste | **Removed**, home now 0 slow frames of 264 |
| S2 | P0 | Layout | City row: horizontal scroller with a clipped last card and no affordance | Impeccable | **Replaced** by a grid, tested at 11 widths |
| S3 | P0 | Structure | Home search bar rendered a server date that differed from the browser's (hydration error, admin too) | Debugging | **Fixed**, tests in 2 time zones |
| S4 | P1 | Content | Contact page shows a fake email (`support@bestcar.example`), a fictional phone number and invented hours | Content | Open, needs real details from the owner |
| S5 | P1 | Content | About: "vetted fleet", "every vehicle inspected and insured" are not what the product does | Content | Open |
| S6 | P1 | Content | Vehicle descriptions are one seed template ("A reliable Honda Civic, well maintained...") | Content | Open |
| S7 | P1 | Interaction | Chat launcher covers the price total in the vehicle booking panel | epic-design gap / Code review | Open |
| S8 | P1 | Product | Cars list cards show name and USD price only: no city, host type or rating | Product | Open |
| S9 | P2 | Content | "Browse Our Fleet", "Most Popular Car Rental Deals" and their subtitles are generic | Content | Open |
| S10 | P2 | Code | About 30 unused translation keys from removed sections | Code review | Open |
| S11 | P2 | Tokens | `detect.mjs`: 8 type-ramp, radius and colour drift findings (11px text, 0.8rem text, Roboto in email HTML) | Impeccable | Open |
