"use client";

import { useRef } from "react";
import { CalendarDays, Car, MapPin } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ScrollReveal } from "@/components/site/scroll-reveal";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEPS = [
  {
    icon: MapPin,
    title: "Choose Location",
    description: "Pick a city near you from dozens of pick-up points across the country.",
  },
  {
    icon: CalendarDays,
    title: "Pick-up Date",
    description: "Tell us when you need the car and for how long. We'll hold it for you.",
  },
  {
    icon: Car,
    title: "Book your car",
    description: "Confirm your details and you're set. Your ride will be ready and waiting.",
  },
];

/**
 * The site's other signature scroll moment (alongside the hero's
 * parallax): the road line draws itself and each step arrives in sequence
 * while the section stays pinned for one viewport-height of scroll — the
 * page literally drives the visitor down the road. Reserved for desktop
 * where the road line exists at all (md:block) and there's room to pin
 * without a phone screen feeling stuck; everyone else (mobile, or
 * prefers-reduced-motion) gets the sequence pre-resolved to its end state
 * with no pin and no scrub, per DESIGN.md's motion rules.
 */
export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        gsap.set(roadRef.current, { scaleX: 0, transformOrigin: "left center" });
        gsap.set(stepRefs.current, { autoAlpha: 0, y: 32, scale: 0.88 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pinRef.current,
            start: "top top",
            end: () => "+=" + window.innerHeight,
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
          },
        });

        tl.to(roadRef.current, { scaleX: 1, ease: "none", duration: 1 }, 0);
        stepRefs.current.forEach((el, i) => {
          tl.to(el, { autoAlpha: 1, y: 0, scale: 1, ease: "power2.out", duration: 0.4 }, i * 0.28);
        });
      });

      mm.add("(prefers-reduced-motion: reduce), (max-width: 767px)", () => {
        gsap.set(roadRef.current, { scaleX: 1 });
        gsap.set(stepRefs.current, { autoAlpha: 1, y: 0, scale: 1 });
      });

      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)"
    >
      <ScrollReveal className="max-w-md font-heading text-3xl font-bold text-foreground">
        <h2>
          Renting a car with us takes three simple steps, from picking a location to driving away.
        </h2>
      </ScrollReveal>

      <div
        ref={pinRef}
        className="relative mt-(--space-xl) flex items-center py-(--space-lg) md:min-h-[46vh]"
      >
        {/* The road: a dashed lane line connecting each step like mile
            markers, drawn left-to-right in sync with the pinned scroll. */}
        <div
          ref={roadRef}
          aria-hidden
          className="absolute inset-x-0 top-1/2 hidden h-px -translate-y-1/2 md:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, color-mix(in oklch, var(--color-muted-foreground) 45%, transparent) 0, color-mix(in oklch, var(--color-muted-foreground) 45%, transparent) 16px, transparent 16px, transparent 32px)",
          }}
        />

        <div className="relative grid w-full grid-cols-1 gap-(--space-lg) md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="relative flex size-16 items-center justify-center rounded-full bg-card text-accent-text ring-1 ring-border">
                <step.icon className="size-7" />
                <span className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="max-w-xs text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
