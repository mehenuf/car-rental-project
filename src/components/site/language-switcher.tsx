"use client";

import { Check, Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setPreferenceCookie } from "@/lib/client-cookie";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/lib/i18n/locales";
import { stripLocale, withLocale } from "@/lib/i18n/negotiate";
import { useLocale, useT } from "@/lib/i18n/provider";

function rememberLocale(locale: Locale) {
  setPreferenceCookie(LOCALE_COOKIE, locale);
}

/** Switch language on the same page: remembers the choice in a cookie, then navigates. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  function choose(next: Locale) {
    if (next === current) return;
    rememberLocale(next);
    const { path } = stripLocale(pathname);
    router.push(withLocale(next, path + window.location.search + window.location.hash));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={className}
            aria-label={t("common.language")}
          />
        }
      >
        <Languages />
        <span className="uppercase">{current}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-48 overflow-y-auto">
        {LOCALES.map((locale) => (
          <DropdownMenuItem key={locale} onClick={() => choose(locale)} lang={locale}>
            <span className="flex-1">{LOCALE_NAMES[locale]}</span>
            {locale === current && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
