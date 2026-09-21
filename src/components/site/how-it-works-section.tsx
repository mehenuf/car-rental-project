"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, Car, MapPin, ShieldCheck } from "lucide-react";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { useT } from "@/lib/i18n/provider";

const STEPS = [
  { icon: MapPin, key: "step1" },
  { icon: CalendarDays, key: "step2" },
  { icon: ShieldCheck, key: "step3" },
  { icon: Car, key: "step4" },
] as const;

/**
 * The four steps of a trip. On desktop a dashed road line draws across and the steps arrive one after another as the
 * section scrolls into view. It is plain CSS transitions switched by one IntersectionObserver: nothing is pinned and
 * no animation library is loaded. Content is visible by default and only hidden (`data-armed`) once the page has
 * loaded and the section is below the fold; reduced motion never hides anything.
 */
export function HowItWorksSection() {
  const t = useT();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.7 && rect.bottom > 0) return;
    el.dataset.armed = "true";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.armed = "false";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="group/how mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <ScrollReveal className="max-w-2xl font-heading text-3xl font-bold text-foreground">
        <h2>{t("howItWorks.title")}</h2>
      </ScrollReveal>

      <div className="relative mt-(--space-lg) flex items-center py-(--space-lg)">
        {/* The road: a dashed lane line connecting the steps like mile markers. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 hidden h-px origin-left -translate-y-1/2 transition-transform duration-(--motion-slow) ease-out group-data-[armed=true]/how:scale-x-0 md:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, color-mix(in oklch, var(--color-muted-foreground) 45%, transparent) 0, color-mix(in oklch, var(--color-muted-foreground) 45%, transparent) 16px, transparent 16px, transparent 32px)",
          }}
        />

        <ol className="relative grid w-full grid-cols-1 gap-(--space-lg) md:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.key}
              style={{ transitionDelay: `${300 + i * 220}ms` }}
              className="flex flex-col items-center gap-3 text-center transition-[opacity,transform] duration-(--motion-slow) ease-out group-data-[armed=true]/how:translate-y-6 group-data-[armed=true]/how:opacity-0"
            >
              <div className="relative flex size-16 items-center justify-center rounded-full bg-card text-accent-text ring-1 ring-border">
                <step.icon className="size-7" />
                <span className="absolute -top-1.5 -end-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground">{t(`howItWorks.${step.key}Title`)}</h3>
              <p className="max-w-xs text-sm text-muted-foreground">{t(`howItWorks.${step.key}Body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
