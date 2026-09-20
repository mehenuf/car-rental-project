"use client";

import { useRef } from "react";
import { CalendarDays, Car, MapPin, ShieldCheck } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { useT } from "@/lib/i18n/provider";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEPS = [
  { icon: MapPin, key: "step1" },
  { icon: CalendarDays, key: "step2" },
  { icon: ShieldCheck, key: "step3" },
  { icon: Car, key: "step4" },
] as const;

/**
 * The road line draws itself and each step arrives in sequence as the
 * section scrolls into view. Nothing is pinned, so scrolling never stalls
 * and the page keeps moving at the visitor's own pace. Only desktop has a
 * road line at all (md:block); mobile and prefers-reduced-motion get the
 * sequence already resolved to its end state.
 */
export function HowItWorksSection() {
  const t = useT();
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
            start: "top 80%",
            end: "bottom 55%",
            scrub: 0.6,
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
      <ScrollReveal className="mx-auto max-w-2xl text-center font-heading text-3xl font-bold text-foreground">
        <h2>{t("howItWorks.title")}</h2>
      </ScrollReveal>

      <div
        ref={pinRef}
        className="relative mt-(--space-lg) flex items-center py-(--space-lg)"
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

        <div className="relative grid w-full grid-cols-1 gap-(--space-lg) md:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.key}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="relative flex size-16 items-center justify-center rounded-full bg-card text-accent-text ring-1 ring-border">
                <step.icon className="size-7" />
                <span className="absolute -top-1.5 -end-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground">{t(`howItWorks.${step.key}Title`)}</h3>
              <p className="max-w-xs text-sm text-muted-foreground">{t(`howItWorks.${step.key}Body`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
