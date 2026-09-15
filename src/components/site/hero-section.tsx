import Link from "next/link";
import { Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HeroParallaxBackground } from "@/components/site/hero-parallax-background";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[92dvh] flex-col overflow-hidden bg-background sm:min-h-[85dvh]">
      <HeroParallaxBackground />

      {/* justify-end + a fixed bottom padding (not justify-center) is
          deliberate: content anchored a fixed distance from the section's
          bottom edge always clears the search bar's negative-margin
          overlap below it, regardless of exact viewport height. Centering
          this content instead left inconsistent, sometimes-zero clearance
          on short/wide viewports, where the trust badge could collide with
          the search bar. */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-(--space-sm) pt-20 pb-24 sm:pb-28">
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
