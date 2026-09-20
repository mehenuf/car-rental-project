import { Link } from "@/lib/i18n/link";
import { buttonVariants } from "@/components/ui/button";
import { HeroScene } from "@/components/site/hero-scene";
import { getLocale, getT } from "@/lib/i18n/dictionary";

export async function HeroSection({ cityNames }: { cityNames: string[] }) {
  const t = await getT();
  const locale = await getLocale();
  const reach = cityNames.length > 0 ? new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(cityNames) : "";

  return (
    <section className="relative flex min-h-[92dvh] flex-col overflow-hidden bg-background sm:min-h-[85dvh]">
      <HeroScene />

      {/* Content sits a fixed distance above the bottom edge so it always clears the search bar that overlaps the
          hero from below, whatever the viewport height. */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-(--space-sm) pt-20 pb-24 sm:pb-28">
        <div className="flex max-w-3xl flex-col gap-(--space-sm)">
          <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            <span className="hero-line-mask">
              <span className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>{t("landing.hero.titleLine1")}</span>
            </span>
            <span className="hero-line-mask">
              <span className="hero-line text-accent" style={{ "--i": 1 } as React.CSSProperties}>{t("landing.hero.titleAccent")}</span>
            </span>
          </h1>
          <p className="animate-title-card max-w-lg text-base text-white/80 sm:text-lg [animation-delay:650ms]">{t("landing.hero.body")}</p>
          <div className="animate-title-card flex flex-col gap-3 pt-(--space-2xs) sm:flex-row [animation-delay:850ms]">
            <Link href="#search-bar" className={buttonVariants({ size: "lg", className: "px-8 shadow-lg shadow-black/30" })}>
              {t("landing.hero.find")}
            </Link>
            <Link
              href="/provider/apply"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/30 bg-white/5 px-8 text-white hover:bg-white/15",
              })}
            >
              {t("landing.hero.list")}
            </Link>
          </div>
          {reach && (
            <p data-chat-avoid className="animate-title-card pt-(--space-2xs) text-sm text-white/70 [animation-delay:1050ms]">
              {t("landing.hero.reach", { cities: reach })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
