import Image from "next/image";
import { BadgeCheck, Headset, MapPinned } from "lucide-react";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";

const FEATURES = [
  { icon: Headset, key: "support" },
  { icon: BadgeCheck, key: "price" },
  { icon: MapPinned, key: "location" },
] as const;

export async function WhyChooseUsSection() {
  const t = await getT();
  return (
    <section id="why-choose-us" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <div className="grid grid-cols-1 items-center gap-(--space-xl) lg:grid-cols-2">
        <ScrollReveal
          y={28}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-card"
        >
          <Image
            src="https://images.unsplash.com/photo-1608142129869-8bc08524503a?auto=format&fit=crop&w=1200&q=80"
            alt={t("whyChooseUs.imageAlt")}
            fill
            sizes="(min-width: 1024px) 500px, 90vw"
            className="object-cover"
          />
        </ScrollReveal>

        <div className="flex flex-col gap-(--space-md)">
          <ScrollReveal className="flex flex-col gap-2">
            <h2 className="font-heading text-3xl font-bold text-foreground">{t("whyChooseUs.title")}</h2>
            <p className="max-w-md text-muted-foreground">{t("whyChooseUs.subtitle")}</p>
          </ScrollReveal>

          <div className="flex flex-col gap-(--space-md)">
            {FEATURES.map((feature, index) => (
              <ScrollReveal
                key={feature.key}
                delay={index * 0.12}
                className="flex items-start gap-4"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-text">
                  <feature.icon className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-heading text-base font-semibold text-foreground">
                    {t(`whyChooseUs.${feature.key}Title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t(`whyChooseUs.${feature.key}Body`)}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
