"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The hero's cinematic signature moment: the night-highway photo drifts at
 * a different rate than the page scrolls (classic film parallax), scrubbed
 * directly to scroll position so it never runs ahead of or lags the user's
 * own input. The image wrapper is sized larger than its slot (120% height,
 * offset -10%) so the parallax travel never reveals empty space at the
 * top/bottom edges.
 */
export function HeroParallaxBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(imgRef.current, {
          yPercent: 16,
          ease: "none",
          scrollTrigger: {
            trigger: wrapRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });
      return () => mm.revert();
    },
    { scope: wrapRef }
  );

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <div ref={imgRef} className="absolute inset-x-0 -top-[12%] h-[124%] will-change-transform">
        <Image
          src="https://images.unsplash.com/photo-1633121945200-05b2a267caee?auto=format&fit=crop&w=2400&q=80"
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      </div>
      {/* Scrim: asphalt-dark at the edges where text and controls sit,
          clear over the middle of the frame where the light trails read. */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />
    </div>
  );
}
