"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Testimonial {
  name: string;
  location: string;
  rating: number;
  quote: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Amelia Clarke",
    location: "Manchester, UK",
    rating: 5,
    quote:
      "Booking took less than five minutes and the car was spotless at pick-up. Easily the smoothest rental experience I've had.",
  },
  {
    name: "James O'Connor",
    location: "Dublin, IE",
    rating: 5,
    quote:
      "Best rates I found for a last-minute weekend trip. The team even upgraded us for free when our first choice wasn't ready.",
  },
  {
    name: "Sofia Marino",
    location: "London, UK",
    rating: 4,
    quote:
      "Great experience overall — drop-off was quick and painless. Only wish there were more pick-up points near the airport.",
  },
  {
    name: "Daniel Kim",
    location: "Edinburgh, UK",
    rating: 5,
    quote:
      "Used BestCar for a family road trip across Scotland. Reliable car, fair price, and zero surprises when we returned it.",
  },
  {
    name: "Priya Sharma",
    location: "Birmingham, UK",
    rating: 5,
    quote:
      "Support answered at midnight when I needed to extend my rental by a day. Genuinely impressed with how responsive they were.",
  },
  {
    name: "Lucas Meyer",
    location: "Bristol, UK",
    rating: 4,
    quote:
      "Smooth booking flow from start to finish, and the SUV we got was perfect for moving house. Will be renting again.",
  },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function TestimonialsSection() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function scrollToIndex(index: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, TESTIMONIALS.length - 1));
    const card = el.children[clamped] as HTMLElement | undefined;
    if (card) {
      el.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
    }
    setActiveIndex(clamped);
  }

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    let closest = 0;
    let closestDistance = Infinity;
    Array.from(el.children).forEach((child, index) => {
      const distance = Math.abs((child as HTMLElement).offsetLeft - el.scrollLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    setActiveIndex(closest);
  }

  return (
    <section id="testimonials" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-heading text-3xl font-bold text-foreground">
          Trusted by Thousands of Happy Customers
        </h2>
        <p className="max-w-xl text-muted-foreground">
          Real stories from renters who booked their next trip with BestCar.
        </p>
      </div>

      <div className="relative mt-(--space-lg)">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="no-scrollbar flex snap-x snap-mandatory gap-(--space-sm) overflow-x-auto scroll-smooth pb-2"
        >
          {TESTIMONIALS.map((testimonial) => (
            <Card
              key={testimonial.name}
              className="w-full shrink-0 snap-start gap-3 p-(--space-md) shadow-card ring-0 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/15 font-heading text-sm font-bold text-accent">
                  {initials(testimonial.name)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{testimonial.name}</span>
                  <span className="text-xs text-muted-foreground">{testimonial.location}</span>
                </div>
              </div>
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-4",
                      i < testimonial.rating ? "fill-current" : "fill-none text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">&ldquo;{testimonial.quote}&rdquo;</p>
            </Card>
          ))}
        </div>

        <div className="mt-(--space-md) flex items-center justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous testimonial"
          >
            <ChevronLeft />
          </Button>
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((testimonial, i) => (
              <button
                key={testimonial.name}
                type="button"
                aria-label={`Go to testimonial ${i + 1}`}
                onClick={() => scrollToIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === activeIndex ? "w-6 bg-accent" : "w-2 bg-muted"
                )}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === TESTIMONIALS.length - 1}
            aria-label="Next testimonial"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </section>
  );
}
