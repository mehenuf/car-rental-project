"use client";

import { useEffect } from "react";

/** Only wide screens with a fine pointer, no reduced-motion request, get the depth effects. */
const CAPABLE = "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Whether this device and connection look able to run the depth effects without costing frames. Conservative on
 * purpose: when in doubt the visitor keeps the still scene, which looks complete on its own.
 */
export function deviceCanAffordEffects(): boolean {
  if (process.env.NEXT_PUBLIC_CINEMATIC_MODE === "off") return false; // the streamlined-mode switch
  if (!window.matchMedia(CAPABLE).matches) return false;
  const nav = navigator as Navigator & { connection?: NetworkInformation; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (nav.connection?.effectiveType && nav.connection.effectiveType !== "4g") return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return false;
  return true;
}

/**
 * Loads the hero's depth effects after the first paint, and only where they are wanted. Everyone else keeps the
 * still scene the server already rendered, and never downloads the animation library for it. Set
 * NEXT_PUBLIC_CINEMATIC_MODE=off to turn the effects off for every visitor without a code change.
 */
export function HeroEffectsLoader() {
  useEffect(() => {
    if (!deviceCanAffordEffects()) return;
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
