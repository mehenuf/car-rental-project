import Link from "next/link";
import { Clock, ShieldCheck, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/scroll-reveal";

export const metadata = { title: "About Us" };

const VALUES = [
  {
    icon: Wallet,
    title: "Transparent pricing",
    body: "The price you see on a car's page is the price you pay. No hidden fees added at checkout.",
  },
  {
    icon: Clock,
    title: "Book in minutes",
    body: "Pick your dates, confirm your details, and you're done. No account required to get started.",
  },
  {
    icon: ShieldCheck,
    title: "Verified fleet",
    body: "Every vehicle listed is inspected and insured before it goes live on the platform.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-(--space-xl) px-(--space-sm) py-(--space-2xl)">
      <ScrollReveal className="flex flex-col gap-(--space-xs) text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Car rental, without the runaround
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          BestCar connects renters with a vetted fleet of vehicles across the UK. We built the
          platform we wished existed: clear pricing, a fast booking flow, and no pressure to
          create an account before you can even see a total.
        </p>
      </ScrollReveal>

      <div className="flex flex-col divide-y divide-border border-t border-border">
        {VALUES.map(({ icon: Icon, title, body }, index) => (
          <ScrollReveal
            key={title}
            className="flex items-start gap-4 py-(--space-md)"
            delay={index * 0.1}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-text">
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal className="flex flex-col items-center gap-(--space-xs) text-center">
        <h2 className="font-heading text-xl font-semibold text-foreground">Ready to rent?</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Browse the fleet and book the right car for your trip today.
        </p>
        <Link href="/cars" className={buttonVariants({ size: "lg" })}>
          Browse cars
        </Link>
      </ScrollReveal>
    </div>
  );
}
