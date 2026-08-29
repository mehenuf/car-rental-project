"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Both icons always render; a `dark:` CSS class decides which one shows.
 * That keeps server and client markup identical (no `mounted` state/effect
 * needed to dodge a hydration mismatch) — next-themes sets the `.dark`
 * class on `<html>` via a blocking inline script before hydration, so the
 * right icon is already showing on first paint, no flash either way.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  );
}
