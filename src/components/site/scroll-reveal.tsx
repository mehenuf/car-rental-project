"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Subtle, slow scroll-triggered fade-in. Content is visible by default in
 * the DOM and the underlying element is only ever hidden by GSAP for
 * something confirmed to be off-screen at setup time — so nothing above
 * the fold, no-JS visitors, and reduced-motion visitors ever see a flash
 * of invisible content (the exact bug the previous IntersectionObserver
 * version of this component had).
 *
 * Relies on `SmoothScrollProvider`'s global `ScrollTrigger.refresh()` (on
 * body resize / fonts ready) to stay correct once async content below the
 * fold shifts this element's real position after this component's own
 * initial setup — see the comment there.
 *
 * `useGSAP`'s scope handles teardown: unmounting kills the tween and its
 * ScrollTrigger automatically, no manual cleanup needed here.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 20,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Travel distance in px. Kept small by default — this is a "subtle" reveal, not a dramatic one. */
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const rect = el.getBoundingClientRect();
        const alreadyVisible = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
        if (alreadyVisible) return; // already on screen — reveal now for no reason to animate

        gsap.fromTo(
          el,
          { autoAlpha: 0, y },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1.1,
            delay,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
