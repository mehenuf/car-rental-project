import { Link } from "@/lib/i18n/link";
import { Car } from "lucide-react";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { getT } from "@/lib/i18n/dictionary";

export async function SiteFooter() {
  const t = await getT();

  const columns: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t("footer.company"),
      links: [
        { label: t("footer.howItWorks"), href: "/#how-it-works" },
        { label: t("footer.browseCars"), href: "/cars" },
        { label: t("footer.aboutUs"), href: "/about" },
        { label: t("footer.listYourCar"), href: "/provider/apply" },
      ],
    },
    {
      title: t("footer.support"),
      links: [
        { label: t("footer.contactUs"), href: "/contact" },
        { label: t("footer.myBookings"), href: "/account" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-card [content-visibility:auto] [contain-intrinsic-size:auto_360px]">
      <div className="mx-auto flex max-w-7xl flex-col gap-(--space-lg) px-(--space-sm) py-(--space-lg)">
        <div className="grid grid-cols-1 gap-(--space-md) sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="flex flex-col gap-(--space-xs)">
            <Link href="/" className="flex min-h-11 items-center gap-2 font-heading text-lg font-bold text-foreground">
              <Car className="size-6 text-accent-text" />
              {t("common.brand")}
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
          </div>

          {columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-(--space-xs)">
              <h2 className="font-heading text-sm font-semibold text-foreground">{column.title}</h2>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-(--space-xs) border-t border-border pt-(--space-sm) text-sm text-muted-foreground sm:flex-row">
          <div className="flex flex-col gap-1">
            <p>{t("footer.copyright", { year: String(new Date().getFullYear()) })}</p>
            <p className="text-xs">{t("footer.demo")}</p>
          </div>
          <div data-chat-avoid className="flex flex-wrap items-center justify-center gap-4">
            <LanguageSwitcher />
            <Link href="/privacy" className="inline-flex min-h-8 items-center hover:text-foreground pointer-coarse:min-h-11">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="inline-flex min-h-8 items-center hover:text-foreground pointer-coarse:min-h-11">
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
