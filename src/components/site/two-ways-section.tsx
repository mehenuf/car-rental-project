import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/lib/i18n/link";
import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";
import type { MarketplaceFacts } from "@/lib/home-data";

/**
 * BestCar has two kinds of visitor: people who rent a car and hosts (rental companies and private owners) who list
 * one. Both get a real entrance here, in one composition: a wide light panel for renters with real cars from the
 * catalogue, and a saturated gold panel for hosts.
 */
export async function TwoWaysSection({ showcase }: { showcase: MarketplaceFacts["showcase"] }) {
  const t = await getT();
  const points = ["point1", "point2", "point3"] as const;
  const steps = ["step1", "step2", "step3"] as const;

  return (
    <section id="two-ways" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <div className="grid grid-cols-1 gap-(--space-sm) lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <ScrollReveal className="relative flex flex-col justify-between gap-(--space-md) overflow-hidden rounded-3xl bg-card p-(--space-md) shadow-card ring-1 ring-border sm:p-(--space-lg)">
          <div className="flex max-w-md flex-col gap-(--space-sm)">
            <h2 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">{t("landing.rent.title")}</h2>
            <p className="text-muted-foreground">{t("landing.rent.body")}</p>
            <ul className="flex flex-col gap-2">
              {points.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
                  {t(`landing.rent.${key}`)}
                </li>
              ))}
            </ul>
            <Link href="/cars" className={buttonVariants({ size: "lg", className: "mt-(--space-2xs) w-fit gap-2 px-6" })}>
              {t("landing.rent.cta")}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          {showcase.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {showcase.map((car, i) => (
                <Link
                  key={car.slug}
                  href={`/cars/${car.slug}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
                  style={{ transform: i === 1 ? "translateY(-8px)" : undefined }}
                >
                  <Image
                    src={car.imageUrl}
                    alt={car.name}
                    fill
                    sizes="(min-width: 1024px) 220px, 30vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs font-medium text-white">
                    {car.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </ScrollReveal>

        <ScrollReveal
          delay={0.1}
          className="flex flex-col justify-between gap-(--space-md) rounded-3xl bg-accent p-(--space-md) text-accent-foreground shadow-card sm:p-(--space-lg)"
        >
          <div className="flex flex-col gap-(--space-sm)">
            <h2 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{t("landing.earn.title")}</h2>
            <p className="max-w-sm text-accent-foreground/85">{t("landing.earn.body")}</p>
            <ol className="flex flex-col gap-2 text-sm">
              {steps.map((key, i) => (
                <li key={key} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-foreground text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{t(`landing.earn.${key}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              href="/register?type=individual"
              className={buttonVariants({ size: "lg", className: "bg-accent-foreground! px-6 text-accent! hover:bg-accent-foreground/90!" })}
            >
              {t("landing.earn.ctaOwner")}
            </Link>
            <Link
              href="/register?type=company"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-accent-foreground/40 bg-transparent! px-6 text-accent-foreground! hover:bg-accent-foreground/10! hover:text-accent-foreground!",
              })}
            >
              {t("landing.earn.ctaCompany")}
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
