# AI-slop register

Severity: P0 blocks use, P1 damages trust or clarity, P2 polish. Status as of 2026-09-21.

| ID | Sev | Area | Finding (evidence) | Owner | Status |
|---|---|---|---|---|---|
| S1 | P0 | Motion | 2.5D hero: pointer parallax, dust canvas, animated streaks, tilt. 38 slow frames of 293 while scrolling home. | Impeccable / taste | **Removed**, home now 0 slow frames of 264 |
| S2 | P0 | Layout | City row: horizontal scroller with a clipped last card and no affordance | Impeccable | **Replaced** by a grid, tested at 11 widths |
| S3 | P0 | Structure | Home search bar rendered a server date that differed from the browser's (hydration error, admin too) | Debugging | **Fixed**, tests in 2 time zones |
| S4 | P1 | Content | Contact page shows a fake email (`support@bestcar.example`), a fictional phone number and invented hours | Content | **Fixed:** contact is chat-only, says the chat is an AI assistant, points to booking messages and disputes and the host portal, and states there is no email or phone yet, needs real details from the owner |
| S5 | P1 | Content | About: "vetted fleet", "every vehicle inspected and insured" are not what the product does | Content | **Fixed:** About rewritten to what the product does; test forbids the old claims |
| S6 | P1 | Content | Vehicle descriptions are one seed template ("A reliable Honda Civic, well maintained...") | Content | **Fixed:** the placeholder is hidden (the spec strip above already shows the facts) |
| S7 | P1 | Interaction | Chat launcher covers the price total in the vehicle booking panel | epic-design gap / Code review | **Fixed:** the whole price breakdown is a chat-avoid zone; tested at 1280 and 390px |
| S8 | P1 | Product | Cars list cards show name and USD price only: no city, host type or rating | Product | **Fixed:** cards show city (+N more), rating and the daily rate in that branch currency; only branches with an active approved unit count |
| S9 | P2 | Content | "Browse Our Fleet", "Most Popular Car Rental Deals" and their subtitles are generic | Content | **Fixed:** "Cars to rent" / "Cars in {place}", "Popular cars", new subtitle |
| S10 | P2 | Code | About 30 unused translation keys from removed sections | Code review | **Fixed:** 21 unused keys removed from all 11 languages (testimonials, why-choose-us, old hero) |
| S11 | P2 | Tokens | `detect.mjs`: 8 type-ramp, radius and colour drift findings (11px text, 0.8rem text, Roboto in email HTML) | Impeccable | Open |
| S12 | P1 | Product | Price filter, price sort and the sidebar slider still use the legacy USD price while cards show the branch currency | Product | **Fixed:** price filter, slider and price sort work only for a chosen place, in that branch currency; the page says so otherwise |
| S13 | P2 | Product | Vehicle descriptions are absent for every sample car; hosts have no field for one in the portal | Product | Open |
