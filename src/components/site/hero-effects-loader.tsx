"use client";

import { useEffect } from "react";

/** Only wide screens with a fine pointer, no reduced-motion request, get the depth effects. */
const CAPABLE = "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * Loads the hero's depth effects after the first paint, and only where they are wanted. Everyone else keeps the
 * still scene the server already rendered, and never downloads the animation library for it.
 */
export function HeroEffectsLoader() {
  useEffect(() => {
    if (!window.matchMedia(CAPABLE).matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const start = () => {
      const root = document.querySelector<HTMLElement>("[data-hero-root]");
      if (!root || cancelled) return;
      import("@/components/site/hero-effects").then((mod) => {
        if (!cancelled) stop = mod.startHeroEffects(root);
      });
    };
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    const handle = idle(start);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
      stop?.();
    };
  }, []);
  return null;
}
