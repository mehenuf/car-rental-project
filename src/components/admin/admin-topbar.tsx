"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/hooks/use-supabase-user";
import { initialsFor } from "@/lib/format";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMaybeT } from "@/lib/i18n/provider";

export function AdminTopbar({
  onMenuClick,
  loginPath = "/admin/login",
  extra,
}: {
  onMenuClick: () => void;
  /** Where to send the user after signing out. */
  loginPath?: string;
  /** Extra controls shown before the theme toggle (for example a provider switcher). */
  extra?: ReactNode;
}) {
  const router = useRouter();
  // The host portal has a translator; the admin console does not and stays English.
  const t = useMaybeT();
  const { user } = useSupabaseUser();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(loginPath);
    router.refresh();
  }

  const fullName = (user?.user_metadata?.full_name as string | undefined) || "";
  const email = user?.email ?? "";
  const initialsSource = fullName || email;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-(--space-sm) border-b border-border bg-card px-(--space-sm) shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 md:hidden"
        onClick={onMenuClick}
        aria-label={t ? t("common.openMenu") : "Open menu"}
      >
        <Menu />
      </Button>

      <div className="ms-auto flex items-center gap-(--space-2xs)">
        {extra}
        <ThemeToggle className="size-11 sm:size-8" label={t ? t("common.toggleTheme") : undefined} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-full sm:size-8"
                aria-label={t ? t("common.accountMenu") : "Account menu"}
              />
            }
          >
            <Avatar>
              <AvatarFallback>{initialsFor(initialsSource || "?")}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {(fullName || email) && (
              <>
                <div className="flex items-center gap-3 px-2.5 py-2">
                  <Avatar className="size-9">
                    <AvatarFallback>{initialsFor(initialsSource || "?")}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {fullName || (t ? t("header.myAccount") : "My Account")}
                    </span>
                    {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              {t ? t("header.logOut") : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
