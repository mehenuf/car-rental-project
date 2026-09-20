"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./locales";
import { withLocale } from "./negotiate";
import { createT, type Messages, type TFunction } from "./t";

interface I18nValue {
  locale: Locale;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createT(locale, messages) }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT and useLocale must be used inside <I18nProvider>");
  return value;
}

export function useT(): TFunction {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** Prefix an internal href with the current language (private and API paths pass through). */
export function useLocalePath(): (href: string) => string {
  const { locale } = useI18n();
  return useCallback((href: string) => withLocale(locale, href), [locale]);
}

/** `useRouter` whose push and replace keep the visitor in their language. */
export function useLocaleRouter() {
  const router = useRouter();
  const localePath = useLocalePath();
  return useMemo(
    () => ({
      push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localePath(href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(localePath(href), options),
      refresh: () => router.refresh(),
    }),
    [router, localePath]
  );
}
