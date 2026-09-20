import { Link } from "@/lib/i18n/link";
import { buttonVariants } from "@/components/ui/button";
import { getT } from "@/lib/i18n/dictionary";

/** Catches `notFound()` calls from within the site section — e.g. a
 * mistyped or removed `/cars/[slug]` — so the header and footer stay put
 * instead of falling through to the chrome-less root 404. */
export default async function SiteNotFound() {
  const t = await getT();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      <span className="font-heading text-6xl font-extrabold text-accent-text">404</span>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("notFound.title")}</h1>
        <p className="text-muted-foreground">{t("notFound.body")}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          {t("common.backHome")}
        </Link>
        <Link href="/cars" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {t("common.browseCars")}
        </Link>
      </div>
    </div>
  );
}
