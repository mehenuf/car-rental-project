import Image from "next/image";
import { BadgeCheck, Headset, MapPinned } from "lucide-react";

const FEATURES = [
  {
    icon: Headset,
    title: "Customer Support",
    description:
      "Our support team is on call around the clock, so help is always a phone call away.",
  },
  {
    icon: BadgeCheck,
    title: "Best Price Guaranteed",
    description: "Transparent, competitive daily rates with no hidden fees at pick-up.",
  },
  {
    icon: MapPinned,
    title: "Many Locations",
    description: "Pick up and drop off at convenient locations in every major city we serve.",
  },
];

export function WhyChooseUsSection() {
  return (
    <section id="why-choose-us" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <div className="grid grid-cols-1 items-center gap-(--space-xl) lg:grid-cols-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] shadow-card">
          <Image
            src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80"
            alt="Customer picking up their rental car"
            fill
            sizes="(min-width: 1024px) 500px, 90vw"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-(--space-md)">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-3xl font-bold text-foreground">Why Choose Us</h2>
            <p className="max-w-md text-muted-foreground">
              A high-performing car rental service built around convenience, transparency, and
              reliability.
            </p>
          </div>

          <div className="flex flex-col gap-(--space-md)">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <feature.icon className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-heading text-base font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
