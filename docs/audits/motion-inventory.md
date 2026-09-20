# Motion inventory

Current state after the hero removal. Native scroll only: no scroll listener drives any animation.

| Effect | Route / component | Trigger | Properties | Duration / easing | Layout impact | Input impact | Device risk | Decision | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Scroll reveal | `scroll-reveal.tsx` (many sections) | IntersectionObserver, once | opacity, transform | 700ms, ease-out expo | none | none | low | Keep, simplify further | 0 slow frames on home |
| How-it-works road and steps | `how-it-works-section.tsx` | IntersectionObserver, once | transform, opacity | 1400ms line, 700ms steps | none | none | low | Keep | as above |
| Button press | `ui/button.tsx` | :active | translate-y 1px | 160ms | none | none | none | Keep | |
| Vehicle card hover | `vehicle-card.tsx` | hover | translate-y -4px, shadow | 200ms | none | none | low | Keep | |
| City tile hover | `city-shelf.tsx` | hover | translate-y -2px, border colour | 200ms | none | none | none | Keep | |
| Popover, select, dropdown open | `ui/*` via tw-animate-css | open | opacity, scale, slide | 100–150ms | none | none | none | Keep | |
| Skeletons | several | loading | opacity pulse | tw default | none | none | low | Keep | |
| Spinners | forms | loading | rotate | tw default | none | none | none | Keep | |
| Chat launcher position | `chat-widget.tsx` | **window scroll listener (passive)**, MutationObserver, rAF | fixed-position style | n/a | none | listener on every page | medium | Review: it should not need a scroll listener; it also fails to avoid the price total | code read; S7 |
| Cookie card | `consent.tsx` | first visit | none | none (removed blur and slide) | none | none | none | Keep | |

Removed in this recovery: pointer parallax, scroll-scrubbed layer drift, dust canvas, animated streaks, backdrop blur on the header, whole-scene tilt, smooth-scroll library (Lenis), route-change page animation, hero title mask animation, 3D tilt on vehicle cards. Dependencies removed: `gsap`, `@gsap/react`, `lenis`.

Global transition default is 160ms with an ease-out curve. Reduced motion: the global `prefers-reduced-motion` rule shortens all animations and transitions; ScrollReveal and HowItWorks skip hiding content entirely when it is set.
