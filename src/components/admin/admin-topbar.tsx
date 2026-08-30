"use client";

import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";

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
              <AvatarFallback>{initialsFor(displayName || "?")}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {displayName && <DropdownMenuLabel>{displayName}</DropdownMenuLabel>}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
