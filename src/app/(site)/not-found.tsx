import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Catches `notFound()` calls from within the site section — e.g. a
 * mistyped or removed `/cars/[slug]` — so the header and footer stay put
 * instead of falling through to the chrome-less root 404. */
export default function SiteNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      <span className="font-heading text-6xl font-extrabold text-accent">404</span>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">Page not found</h1>
        <p className="text-muted-foreground">
          That page doesn&apos;t exist or may have moved — it might be a car that&apos;s no longer
          in our fleet.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Back to homepage
        </Link>
        <Link href="/cars" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Browse cars
        </Link>
      </div>
    </div>
  );
}
