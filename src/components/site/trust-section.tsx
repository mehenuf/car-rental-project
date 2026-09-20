import Image from "next/image";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";

const ITEMS = ["verified", "price", "deposit", "reviews", "disputes", "languages"] as const;

/** What the platform does for both sides, in plain sentences. A ruled list rather than a row of cards. */
export async function TrustSection() {
  const t = await getT();
  return (
    <section id="trust" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <div className="grid grid-cols-1 gap-(--space-xl) lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <ScrollReveal className="flex flex-col gap-(--space-md) lg:sticky lg:top-24">
          <h2 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">{t("landing.trust.title")}</h2>
          <p className="max-w-md text-muted-foreground">{t("landing.trust.subtitle")}</p>
          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl shadow-card lg:block">
            <Image
              src="https://images.unsplash.com/photo-1608142129869-8bc08524503a?auto=format&fit=crop&w=1200&q=80"
              alt={t("whyChooseUs.imageAlt")}
              fill
              sizes="480px"
              className="object-cover"
            />
          </div>
        </ScrollReveal>

        <dl className="grid grid-cols-1 sm:grid-cols-2">
          {ITEMS.map((key, i) => (
            <ScrollReveal
              key={key}
              delay={(i % 2) * 0.08}
              className="flex flex-col gap-1 border-t border-border py-(--space-sm) sm:pe-(--space-md)"
            >
              <dt className="font-heading text-lg font-semibold text-foreground">{t(`landing.trust.${key}Title`)}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{t(`landing.trust.${key}Body`)}</dd>
            </ScrollReveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
