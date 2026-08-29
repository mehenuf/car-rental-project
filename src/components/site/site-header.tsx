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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SITE_NAV_LINKS } from "@/lib/site-nav";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/hooks/use-supabase-user";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
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

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm supports-backdrop-filter:bg-card/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-(--space-sm) px-(--space-sm)">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-bold text-foreground"
        >
          <Car className="size-6 text-accent" />
          BestCar
        </Link>

        <nav className="ml-6 hidden items-center gap-6 lg:flex">
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

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {!loading && !user && (
            <>
              <Link href="/register" className={buttonVariants({ variant: "outline" })}>
                Register
              </Link>
              <Link href="/login" className={buttonVariants()}>
                Log In
              </Link>
            </>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" className="rounded-full" aria-label="Account menu" />}
              >
                <Avatar>
                  <AvatarFallback>{initialsFor(displayName || "?")}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <LayoutDashboard /> Admin Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-72 flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Car className="size-6 text-accent" /> BestCar
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
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Admin Dashboard
                  </Link>
                )}
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
