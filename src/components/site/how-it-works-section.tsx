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
    description: "Tell us when you need the car and for how long — we'll hold it for you.",
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
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-heading text-3xl font-bold text-foreground">How it Works</h2>
        <p className="max-w-xl text-muted-foreground">
          Renting a car with us takes three simple steps, from picking a location to driving away.
        </p>
      </div>

      <div className="relative mt-(--space-xl)">
        <svg
          viewBox="0 0 3 1"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 top-10 hidden h-24 w-full text-accent/40 md:block"
          fill="none"
        >
          <path
            d="M 0.18 0.15 Q 0.5 0.95 0.82 0.15"
            stroke="currentColor"
            strokeWidth="0.008"
            strokeDasharray="0.025 0.025"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="relative grid grid-cols-1 gap-(--space-lg) md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent ring-8 ring-background">
                <step.icon className="size-7" />
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
