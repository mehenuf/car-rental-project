import { pageMetadata } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/link";
import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";

export async function generateMetadata() {
  const t = await getT();
  return pageMetadata("/about", { title: t("meta.about") });
}

const POINTS = ["1", "2", "3"] as const;

/** Two audiences, side by side, each with the three things that matter to them. */
export default async function AboutPage() {
  const t = await getT();
  const columns = [
    { id: "renters", title: t("about.rentersTitle"), prefix: "r", action: { href: "/cars", label: t("common.browseCars"), primary: true } },
    { id: "hosts", title: t("about.hostsTitle"), prefix: "h", action: { href: "/register?type=individual", label: t("landing.earn.ctaOwner"), primary: false } },
  ] as const;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-(--space-xl) px-(--space-sm) py-(--space-2xl)">
      <ScrollReveal className="flex max-w-2xl flex-col gap-(--space-xs)">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("about.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("about.intro")}</p>
      </ScrollReveal>

      <div className="grid grid-cols-1 gap-(--space-lg) md:grid-cols-2">
        {columns.map((column, index) => (
          <ScrollReveal key={column.id} delay={index * 0.08} className="flex flex-col gap-(--space-sm)">
            <section aria-labelledby={`about-${column.id}`} className="flex flex-col gap-(--space-sm)">
              <h2 id={`about-${column.id}`} className="border-b border-border pb-2 font-heading text-xl font-semibold text-foreground">
                {column.title}
              </h2>
              <ul className="flex flex-col gap-(--space-sm)">
                {POINTS.map((n) => (
                  <li key={n} className="flex flex-col gap-1">
                    <h3 className="font-heading text-base font-semibold text-foreground">{t(`about.${column.prefix}${n}Title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`about.${column.prefix}${n}Body`)}</p>
                  </li>
                ))}
              </ul>
              <Link
                href={column.action.href}
                className={buttonVariants({ size: "lg", variant: column.action.primary ? "default" : "outline", className: "w-fit" })}
              >
                {column.action.label}
              </Link>
            </section>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
