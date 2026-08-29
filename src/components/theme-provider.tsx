"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Toggles the `.dark` class on `<html>` — matches the `@custom-variant dark
 * (&:is(.dark *))` selector in globals.css, so every existing `dark:`
 * utility and the `.dark { ... }` token block just start working once this
 * is mounted. No CSS changes needed; both palettes already existed.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}
