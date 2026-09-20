import { pageMetadata } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/link";
import { Clock, ShieldCheck, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";

export const generateMetadata = () => pageMetadata("/about", { title: "About Us" });

const VALUES = [
  { icon: Wallet, key: "v1" },
  { icon: Clock, key: "v2" },
  { icon: ShieldCheck, key: "v3" },
] as const;

export default async function AboutPage() {
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-(--space-xl) px-(--space-sm) py-(--space-2xl)">
      <ScrollReveal className="flex flex-col gap-(--space-xs) text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("about.title")}
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t("about.intro")}
        </p>
      </ScrollReveal>

      <div className="flex flex-col divide-y divide-border border-t border-border">
        {VALUES.map(({ icon: Icon, key }, index) => (
          <ScrollReveal
            key={key}
            className="flex items-start gap-4 py-(--space-md)"
            delay={index * 0.1}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-text">
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base font-semibold text-foreground">{t(`about.${key}Title`)}</h2>
              <p className="text-sm text-muted-foreground">{t(`about.${key}Body`)}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal className="flex flex-col items-center gap-(--space-xs) text-center">
        <h2 className="font-heading text-xl font-semibold text-foreground">{t("about.readyTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("about.readyBody")}</p>
        <Link href="/cars" className={buttonVariants({ size: "lg" })}>
          {t("common.browseCars")}
        </Link>
      </ScrollReveal>
    </div>
  );
}
