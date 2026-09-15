import { CalendarDays, Car, MapPin } from "lucide-react";

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

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <h2 className="max-w-md font-heading text-3xl font-bold text-foreground">
        Renting a car with us takes three simple steps, from picking a location to driving away.
      </h2>

      <div className="relative mt-(--space-xl)">
        {/* The road: a solid shoulder line top and bottom, a dashed lane
            line down the middle, connecting each step like mile markers. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 hidden h-px -translate-y-1/2 md:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, color-mix(in oklch, var(--color-muted-foreground) 45%, transparent) 0, color-mix(in oklch, var(--color-muted-foreground) 45%, transparent) 16px, transparent 16px, transparent 32px)",
          }}
        />

        <div className="relative grid grid-cols-1 gap-(--space-lg) md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center gap-3 text-center">
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
