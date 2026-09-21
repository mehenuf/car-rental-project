# Motion inventory

Current state after the hero removal. Native scroll only: no scroll listener drives any animation.

| Effect | Route / component | Trigger | Properties | Duration / easing | Layout impact | Input impact | Device risk | Decision | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Scroll reveal | `scroll-reveal.tsx` (many sections) | IntersectionObserver, once | opacity, transform | `--motion-slow` 450ms, `--ease-standard` | none | none | low | Keep, simplify further | 0 slow frames on home |
| How-it-works road and steps | `how-it-works-section.tsx` | IntersectionObserver, once | transform, opacity | `--motion-slow` for line and steps | none | none | low | Keep | as above |
| Button press | `ui/button.tsx` | :active | translate-y 1px | `--motion-fast` 150ms | none | none | none | Keep | |
| Vehicle card hover | `vehicle-card.tsx` | hover | translate-y -4px, shadow | `--motion-medium` 220ms | none | none | low | Keep | |
| City tile hover | `city-shelf.tsx` | hover | translate-y -2px, border colour | `--motion-medium` 220ms | none | none | none | Keep | |
| Popover, select, dropdown open | `ui/*` via tw-animate-css | open | opacity, scale, slide | `--motion-fast` | none | none | none | Keep | |
| Skeletons | several | loading | opacity pulse | tw default | none | none | low | Keep | |
| Spinners | forms | loading | rotate | tw default | none | none | none | Keep | |
| Chat launcher position | `chat-widget.tsx` | passive window scroll and resize listeners, MutationObserver (childList only), rAF-coalesced | fixed-position opacity | n/a | none | listener on every page | low | Keep: it fades out of the way of price totals and the cookie bar (`data-chat-avoid`) | e2e: chat vs price at 2 widths |
| Cookie card | `consent.tsx` | first visit | none | none (removed blur and slide) | none | none | none | Keep | |

Removed in this recovery: pointer parallax, scroll-scrubbed layer drift, dust canvas, animated streaks, backdrop blur on the header, whole-scene tilt, smooth-scroll library (Lenis), route-change page animation, hero title mask animation, 3D tilt on vehicle cards. Dependencies removed: `gsap`, `@gsap/react`, `lenis`.

Motion tokens live in `globals.css`: `--motion-fast` 150ms (hover, focus, press, small overlays), `--motion-medium` 220ms (menus, dialogs, sheets, card lift), `--motion-slow` 450ms (one-time reveals), `--ease-standard` cubic-bezier(0.16, 1, 0.3, 1). Every duration in `src` uses a token; the Tailwind default transition uses `--motion-fast`. Reduced motion: the global `prefers-reduced-motion` rule shortens all animations and transitions to 0.01ms; ScrollReveal and HowItWorks skip hiding content.

Removed on 2026-09-21 (second pass): the backdrop blur on dialog and sheet overlays (the last blur effect; the overlay is now a plain 40% scrim), and the 700 ms and 1400 ms one-off durations.
