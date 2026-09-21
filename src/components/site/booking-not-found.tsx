import { Link } from "@/lib/i18n/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getT } from "@/lib/i18n/dictionary";

/**
 * Shown when a booking reference is missing, mistyped, or belongs to another browser or account. It says what
 * probably happened and where to go next, instead of the car-page 404 ("a car that is no longer in our fleet").
 */
export async function BookingNotFound() {
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-8" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("bookingLookup.title")}</h1>
        <p className="text-muted-foreground">{t("bookingLookup.body")}</p>
      </div>
      <div className="flex flex-col gap-(--space-xs) sm:flex-row">
        <Link href="/account" className={buttonVariants({ size: "lg" })}>
          {t("confirmation.viewBookings")}
        </Link>
        <Link href="/cars" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {t("confirmation.browseMore")}
        </Link>
      </div>
    </div>
  );
}
