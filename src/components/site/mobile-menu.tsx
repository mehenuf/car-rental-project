"use client";

import { Car, User } from "lucide-react";
import { Link } from "@/lib/i18n/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SITE_NAV_LINKS } from "@/lib/site-nav";
import { directionOf } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * The phone menu. It is loaded the first time the menu button is used (or when the button is hovered or focused), so
 * the dialog code is not part of every page's first load.
 */
export default function MobileMenu({
  open,
  onOpenChange,
  loading,
  signedIn,
  isAdmin,
  displayName,
  isCurrent,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  signedIn: boolean;
  isAdmin: boolean;
  displayName: string;
  isCurrent: (href: string) => boolean;
  onLogout: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={directionOf(locale) === "rtl" ? "left" : "right"} className="flex w-72 flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Car className="size-6 text-accent-text" /> {t("common.brand")}
          </SheetTitle>
        </SheetHeader>
        <nav aria-label={t("common.mainNav")} className="flex flex-col gap-1 px-4">
          {SITE_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold"
            >
              {t(`nav.${link.labelKey}`)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 p-4">
          {!loading && !signedIn && (
            <>
              <Link href="/account" onClick={close} className={buttonVariants({ variant: "outline" })}>
                {t("header.myBookings")}
              </Link>
              <Link href="/register" onClick={close} className={buttonVariants({ variant: "outline" })}>
                {t("header.register")}
              </Link>
              <Link href="/login" onClick={close} className={buttonVariants()}>
                {t("header.logIn")}
              </Link>
            </>
          )}

          {signedIn && (
            <>
              <div className="flex items-center gap-2 px-1 text-sm font-medium text-foreground">
                <User className="size-4" /> {displayName}
              </div>
              <Link href={isAdmin ? "/admin" : "/account"} onClick={close} className={buttonVariants({ variant: "outline" })}>
                {isAdmin ? t("header.adminDashboard") : t("header.myBookings")}
              </Link>
              <Button type="button" variant="destructive" onClick={onLogout}>
                {t("header.logOut")}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
