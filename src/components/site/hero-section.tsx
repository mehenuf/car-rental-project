import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-(--space-lg) px-(--space-sm) py-(--space-xl) lg:grid-cols-2 lg:py-(--space-2xl)">
        <div className="flex flex-col gap-(--space-sm)">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            100% Trusted Car Rental Platform in the UK
          </span>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.1] text-foreground sm:text-5xl lg:text-6xl">
            Fast and Easy Way to <span className="text-accent">Rent a Car</span>
          </h1>
          <p className="max-w-md text-base text-muted-foreground sm:text-lg">
            Our car rental booking platform is built for rental businesses of any size —
            manage your fleet, take bookings, and grow your business with easy-to-use tools.
          </p>
          <div className="flex flex-col gap-3 pt-(--space-2xs) sm:flex-row">
            <Link href="#search-bar" className={buttonVariants({ size: "lg", className: "px-8" })}>
              Booking Now
            </Link>
            <Link
              href="/cars"
              className={buttonVariants({ variant: "outline", size: "lg", className: "px-8" })}
            >
              See all cars
            </Link>
          </div>
        </div>

        <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
          <div className="absolute inset-6 rounded-[3rem] bg-accent/15 blur-2xl" aria-hidden />
          <div className="relative size-full overflow-hidden rounded-[2rem] shadow-card">
            <Image
              src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80"
              alt="Car available for rent"
              fill
              sizes="(min-width: 1024px) 500px, 90vw"
              className="object-cover"
              priority
            />
          </div>
          <div className="absolute -bottom-6 -left-6 flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-foreground/5">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Star className="size-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">4.9 / 5</span>
              <span className="text-xs text-muted-foreground">2,400+ happy renters</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
