import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[92dvh] flex-col overflow-hidden bg-background sm:min-h-[85dvh]">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1633121945200-05b2a267caee?auto=format&fit=crop&w=2400&q=80"
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        {/* Scrim: asphalt-dark at the edges where text and controls sit,
            clear over the middle of the frame where the light trails read. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-(--space-sm) pt-20">
        <div className="animate-title-card flex max-w-2xl flex-col gap-(--space-sm)">
          <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-7xl lg:text-8xl">
            Rent the road
            <br />
            <span className="text-accent">tonight.</span>
          </h1>
          <p className="max-w-md text-base text-white/80 sm:text-lg">
            Pick your dates, choose your car, and drive off in minutes. No account required, and
            the price you see is the price you pay.
          </p>
          <div className="flex flex-col gap-3 pt-(--space-2xs) sm:flex-row">
            <Link
              href="#search-bar"
              className={buttonVariants({ size: "lg", className: "px-8 shadow-lg shadow-black/30" })}
            >
              Book now
            </Link>
            <Link
              href="/cars"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/30 bg-white/5 px-8 text-white hover:bg-white/15",
              })}
            >
              See all cars
            </Link>
          </div>
        </div>

        <div
          data-chat-avoid
          className="mt-(--space-lg) flex w-fit items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/10"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-accent/20 text-accent">
            <Star className="size-5 fill-current" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white">4.9 / 5</span>
            <span className="text-xs text-white/70">2,400+ happy renters</span>
          </div>
        </div>
      </div>
    </section>
  );
}
