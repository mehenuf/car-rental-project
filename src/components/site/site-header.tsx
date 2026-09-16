"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, LayoutDashboard, Menu, User } from "lucide-react";
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
  const initialsSource = name || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className="rounded-full" aria-label="Account menu" />}
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
              {name || "My Account"}
            </span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={isAdmin ? "/admin" : "/dashboard"} />}>
          <LayoutDashboard /> {isAdmin ? "Admin Dashboard" : "My Bookings"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
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
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm supports-backdrop-filter:bg-card/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-(--space-sm) px-(--space-sm)">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-bold text-foreground"
        >
          <Car className="size-6 text-accent-text" />
          BestCar
        </Link>

        <nav className="ml-4 hidden items-center gap-4 md:flex lg:ml-6 lg:gap-6">
          {SITE_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Full auth actions (text links + both CTAs) only fit from lg up —
            below that, the compact tablet block right after this one covers
            md-lg with a single CTA instead of leaving a hamburger-only dead
            zone despite there being room for the nav. */}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {!loading && !user && (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                My Bookings
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "outline" })}>
                Register
              </Link>
              <Link href="/login" className={buttonVariants()}>
                Log In
              </Link>
            </>
          )}

          {user && (
            <AccountMenu name={fullName} email={user.email ?? ""} isAdmin={isAdmin} onLogout={handleLogout} />
          )}
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex lg:hidden">
          <ThemeToggle />
          {!loading && !user && (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Log In
            </Link>
          )}
          {user && (
            <AccountMenu name={fullName} email={user.email ?? ""} isAdmin={isAdmin} onLogout={handleLogout} />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle className="size-11" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-72 flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Car className="size-6 text-accent-text" /> BestCar
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
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 p-4">
            {!loading && !user && (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  My Bookings
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Register
                </Link>
                <Link href="/login" onClick={() => setOpen(false)} className={buttonVariants()}>
                  Log In
                </Link>
              </>
            )}

            {user && (
              <>
                <div className="flex items-center gap-2 px-1 text-sm font-medium text-foreground">
                  <User className="size-4" /> {displayName}
                </div>
                <Link
                  href={isAdmin ? "/admin" : "/dashboard"}
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {isAdmin ? "Admin Dashboard" : "My Bookings"}
                </Link>
                <Button type="button" variant="destructive" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
