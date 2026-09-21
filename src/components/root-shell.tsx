import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { fontClassesFor } from "@/lib/fonts";
import { directionOf, type Locale } from "@/lib/i18n/locales";
import { CONSENT_COOKIE, CURRENT_POLICY_VERSION } from "@/lib/consent";

/** Marks the page before first paint when this browser has already answered the cookie question. */
const CONSENT_SNIPPET = `try{var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);var c=m&&JSON.parse(decodeURIComponent(m[1]));if(c&&c.v===${JSON.stringify(CURRENT_POLICY_VERSION)})document.documentElement.setAttribute("data-consent","set")}catch(e){}`;
import "@/app/globals.css";

/** The one `<html>`/`<body>` shared by the public site (per language) and the private portals (English). */
export async function RootShell({
  locale,
  skipLabel,
  children,
}: {
  locale: Locale;
  skipLabel: string;
  children: ReactNode;
}) {
  const fontClasses = await fontClassesFor(locale);
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${fontClasses} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: CONSENT_SNIPPET }} />
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
