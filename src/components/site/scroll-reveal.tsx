"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * A quiet fade-and-rise as content scrolls into view. It uses one IntersectionObserver and CSS transitions, with no
 * animation library, so it costs almost nothing. Content is visible by default: it is only hidden after the page
 * has loaded, and only when it is below the fold, so there is never a flash of missing content and no-JS visitors
 * and reduced-motion visitors see everything at once.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 16,
  scale = 0.985,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Travel distance in px. */
  y?: number;
  /** Starting scale, animating to 1. Set to 1 to disable. */
  scale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) return; // already on screen
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.reveal = "shown";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ "--reveal-y": `${y}px`, "--reveal-scale": scale, "--reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
