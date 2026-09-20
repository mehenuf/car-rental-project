import { Link } from "@/lib/i18n/link";
import { buttonVariants } from "@/components/ui/button";
import { HeroParallaxBackground } from "@/components/site/hero-parallax-background";
import { getLocale, getT } from "@/lib/i18n/dictionary";

export async function HeroSection({ cityNames }: { cityNames: string[] }) {
  const t = await getT();
  const locale = await getLocale();
  const reach = cityNames.length > 0 ? new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(cityNames) : "";

  return (
    <section className="relative flex min-h-[92dvh] flex-col overflow-hidden bg-background sm:min-h-[85dvh]">
      <HeroParallaxBackground />

      {/* Content sits a fixed distance above the bottom edge so it always clears the search bar that overlaps the
          hero from below, whatever the viewport height. */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-(--space-sm) pt-20 pb-24 sm:pb-28">
        <div className="animate-title-card flex max-w-3xl flex-col gap-(--space-sm)">
          <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            {t("landing.hero.titleLine1")}
            <br />
            <span className="text-accent">{t("landing.hero.titleAccent")}</span>
          </h1>
          <p className="max-w-lg text-base text-white/80 sm:text-lg">{t("landing.hero.body")}</p>
          <div className="flex flex-col gap-3 pt-(--space-2xs) sm:flex-row">
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
            <p data-chat-avoid className="pt-(--space-2xs) text-sm text-white/70">
              {t("landing.hero.reach", { cities: reach })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
