"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Link } from "@/lib/i18n/link";
import { usePathname } from "next/navigation";
import { useLocaleRouter } from "@/lib/i18n/provider";
import { Building2, Car, LayoutDashboard, Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SITE_NAV_LINKS } from "@/lib/site-nav";
import { useSupabaseUser } from "@/hooks/use-supabase-user";
import { ThemeToggle } from "@/components/theme-toggle";
import { initialsFor } from "@/lib/format";
import { LocationChip } from "@/components/location/location-chip";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

// Loaded the first time the menu button is used or approached, so the dialog code is not in every first load.
const loadMobileMenu = () => import("@/components/site/mobile-menu");
const MobileMenu = dynamic(loadMobileMenu, { ssr: false });
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
  // "/en/cars/x" -> "/cars/x": which header link is the page you are on (links to a section of the home page never are).
  const bare = "/" + usePathname().split("/").slice(2).join("/");
  const isCurrent = (href: string) =>
    !href.includes("#") && (href === "/" ? bare === "/" : bare === href || bare.startsWith(`${href}/`));
  const [open, setOpen] = useState(false);
  const [menuRequested, setMenuRequested] = useState(false);
  const router = useLocaleRouter();
  const { user, isAdmin, loading } = useSupabaseUser();

  async function handleLogout() {
    const { supabase } = await import("@/lib/supabase");
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
          className="flex min-h-11 shrink-0 items-center gap-2 font-heading text-lg font-bold text-foreground"
        >
          <Car className="size-6 text-accent-text" />
          {/* On the narrowest phones the mark alone keeps the row on one line; the name stays for screen readers. */}
          <span className="max-[359px]:sr-only">{t("common.brand")}</span>
        </Link>

        <LocationChip className="h-11 min-w-11 px-2 md:h-8" />

        <nav aria-label={t("common.mainNav")} className="ms-4 hidden items-center gap-4 md:flex lg:ms-6 lg:gap-6">
          {SITE_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
            >
              {t(`nav.${link.labelKey}`)}
            </Link>
          ))}
        </nav>

        {/* One set of controls for every width. The sign-in links show from md (the register link and My bookings from lg),
            and below md the menu button takes their place. */}
        <div className="ms-auto flex items-center gap-1 md:gap-2">
          <LanguageSwitcher className="h-11 md:h-8" />
          <ThemeToggle className="size-11 md:size-8" label={t("common.toggleTheme")} />
          {!loading && !user && (
            <>
              <Link
                href="/account"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:inline"
              >
                {t("header.myBookings")}
              </Link>
              <Link href="/register" className={cn(buttonVariants({ variant: "outline" }), "hidden lg:inline-flex")}>
                {t("header.register")}
              </Link>
              <Link href="/login" className={cn(buttonVariants(), "hidden md:inline-flex")}>
                {t("header.logIn")}
              </Link>
            </>
          )}
          {user && (
            <div className="hidden md:block">
              <AccountMenu name={fullName} email={user.email ?? ""} isAdmin={isAdmin} onLogout={handleLogout} />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 md:hidden"
            onClick={() => {
              setMenuRequested(true);
              setOpen(true);
            }}
            onPointerEnter={() => void loadMobileMenu()}
            onFocus={() => void loadMobileMenu()}
            aria-label={t("common.openMenu")}
          >
            <Menu />
          </Button>
        </div>
      </div>

      {menuRequested && (
        <MobileMenu
          open={open}
          onOpenChange={setOpen}
          loading={loading}
          signedIn={Boolean(user)}
          isAdmin={isAdmin}
          displayName={displayName}
          isCurrent={isCurrent}
          onLogout={handleLogout}
        />
      )}
    </header>
  );
}
