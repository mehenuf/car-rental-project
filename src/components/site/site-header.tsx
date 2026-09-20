"use client";

import { useState } from "react";
import { Link } from "@/lib/i18n/link";
import { useLocaleRouter } from "@/lib/i18n/provider";
import { Building2, Car, LayoutDashboard, Menu, User } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SITE_NAV_LINKS } from "@/lib/site-nav";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/hooks/use-supabase-user";
import { ThemeToggle } from "@/components/theme-toggle";
import { initialsFor } from "@/lib/format";
import { LocationChip } from "@/components/location/location-chip";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { useLocale, useT } from "@/lib/i18n/provider";
import { directionOf } from "@/lib/i18n/locales";

function AccountMenu({
  name,
  email,
  isAdmin,
  onLogout,
}: {
  name: string;
  email: string;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const t = useT();
  const initialsSource = name || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className="rounded-full" aria-label={t("common.accountMenu")} />}
      >
        <Avatar>
          <AvatarFallback>{initialsFor(initialsSource || "?")}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* A name/email pair reads as a real account identity; the raw
            email alone in a plain menu-label style read as debug output,
            not a personalized "you're signed in" moment. */}
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar className="size-9">
            <AvatarFallback>{initialsFor(initialsSource || "?")}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {name || t("header.myAccount")}
            </span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={isAdmin ? "/admin" : "/account"} />}>
          <LayoutDashboard /> {isAdmin ? t("header.adminDashboard") : t("header.myBookings")}
        </DropdownMenuItem>
        {!isAdmin && (
          <DropdownMenuItem render={<Link href="/provider" />}>
            <Building2 /> {t("header.partnerPortal")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          {t("header.logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const router = useLocaleRouter();
  const { user, isAdmin, loading } = useSupabaseUser();

  async function handleLogout() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const fullName = (user?.user_metadata?.full_name as string | undefined) || "";
  const displayName = fullName || user?.email || "";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-(--space-xs) px-(--space-sm) sm:gap-(--space-sm)">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-bold text-foreground"
        >
          <Car className="size-6 text-accent-text" />
          {/* On the narrowest phones the mark alone keeps the row on one line; the name stays for screen readers. */}
          <span className="max-[359px]:sr-only">{t("common.brand")}</span>
        </Link>

        <LocationChip className="h-11 min-w-11 px-2 md:h-8" />

        <nav className="ms-4 hidden items-center gap-4 md:flex lg:ms-6 lg:gap-6">
          {SITE_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`nav.${link.labelKey}`)}
            </Link>
          ))}
        </nav>

        {/* Full auth actions (text links + both CTAs) only fit from lg up —
            below that, the compact tablet block right after this one covers
            md-lg with a single CTA instead of leaving a hamburger-only dead
            zone despite there being room for the nav. */}
        <div className="ms-auto hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          {!loading && !user && (
            <>
              <Link
                href="/account"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("header.myBookings")}
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "outline" })}>
                {t("header.register")}
              </Link>
              <Link href="/login" className={buttonVariants()}>
                {t("header.logIn")}
              </Link>
            </>
          )}

          {user && (
            <AccountMenu name={fullName} email={user.email ?? ""} isAdmin={isAdmin} onLogout={handleLogout} />
          )}
        </div>

        <div className="ms-auto hidden items-center gap-2 md:flex lg:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          {!loading && !user && (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              {t("header.logIn")}
            </Link>
          )}
          {user && (
            <AccountMenu name={fullName} email={user.email ?? ""} isAdmin={isAdmin} onLogout={handleLogout} />
          )}
        </div>

        <div className="ms-auto flex items-center gap-1 md:hidden">
          <LanguageSwitcher className="h-11" />
          <ThemeToggle className="size-11" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => setOpen(true)}
            aria-label={t("common.openMenu")}
          >
            <Menu />
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={directionOf(locale) === "rtl" ? "left" : "right"} className="flex w-72 flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Car className="size-6 text-accent-text" /> {t("common.brand")}
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {SITE_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {t(`nav.${link.labelKey}`)}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 p-4">
            {!loading && !user && (
              <>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("header.myBookings")}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("header.register")}
                </Link>
                <Link href="/login" onClick={() => setOpen(false)} className={buttonVariants()}>
                  {t("header.logIn")}
                </Link>
              </>
            )}

            {user && (
              <>
                <div className="flex items-center gap-2 px-1 text-sm font-medium text-foreground">
                  <User className="size-4" /> {displayName}
                </div>
                <Link
                  href={isAdmin ? "/admin" : "/account"}
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {isAdmin ? t("header.adminDashboard") : t("header.myBookings")}
                </Link>
                <Button type="button" variant="destructive" onClick={handleLogout}>
                  {t("header.logOut")}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
