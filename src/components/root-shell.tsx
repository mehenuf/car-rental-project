import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { fontClassesFor } from "@/lib/fonts";
import { directionOf, type Locale } from "@/lib/i18n/locales";
import "@/app/globals.css";

/** The one `<html>`/`<body>` shared by the public site (per language) and the private portals (English). */
export function RootShell({
  locale,
  skipLabel,
  children,
}: {
  locale: Locale;
  skipLabel: string;
  children: ReactNode;
}) {
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${fontClassesFor(locale)} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground focus:shadow-lg"
        >
          {skipLabel}
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
