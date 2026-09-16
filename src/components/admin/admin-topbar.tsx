"use client";

import { useRouter } from "next/navigation";
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

export function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user } = useSupabaseUser();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
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
        aria-label="Open menu"
      >
        <Menu />
      </Button>

      <div className="ml-auto flex items-center gap-(--space-2xs)">
        <ThemeToggle className="size-11 sm:size-8" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-full sm:size-8"
                aria-label="Account menu"
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
                      {fullName || "My Account"}
                    </span>
                    {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
