"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/link";
import { useT } from "@/lib/i18n/provider";
import { CONSENT_COOKIE, analyticsAllowed, encodeConsent, needsBanner } from "@/lib/consent";

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
}

/**
 * The cookie banner and the analytics it controls. Necessary cookies (session, language, theme) need no consent;
 * analytics stay off until the visitor says yes, and the choice is asked again when the policy version changes.
 */
export function ConsentManager() {
  const t = useT();
  const [state, setState] = useState<{ ready: boolean; banner: boolean; analytics: boolean }>({ ready: false, banner: true, analytics: false });

  useEffect(() => {
    const raw = readCookie();
    // Read once on mount: the cookie only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ready: true, banner: needsBanner(raw), analytics: analyticsAllowed(raw) });
  }, []);

  function choose(analytics: boolean) {
    document.cookie = `${CONSENT_COOKIE}=${encodeConsent({ analytics })}; path=/; max-age=31536000; samesite=lax`;
    setState({ ready: true, banner: false, analytics });
    // Keep a record of the choice with the policy version (best effort; the cookie is what counts in the browser).
    void fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analytics }) }).catch(() => undefined);
  }

  return (
    <>
      {state.analytics && <Analytics />}
      {/* Rendered by the server so it is part of the first paint. A returning visitor never sees it: a tiny script in the
          page sets `data-consent` before anything is drawn, and CSS hides the banner until this component has checked. */}
      {(!state.ready || state.banner) && (
        <div
          data-consent-banner
          role="dialog"
          aria-labelledby="consent-title"
          aria-describedby="consent-body"
          className="fixed inset-x-3 bottom-3 z-[90] flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xl sm:inset-x-auto sm:bottom-4 sm:start-4 sm:max-w-sm"
        >
          <div className="flex flex-col gap-1">
            <p id="consent-title" className="font-heading text-sm font-semibold text-foreground">{t("consent.title")}</p>
            <p id="consent-body" className="text-xs leading-relaxed text-muted-foreground">
              {t("consent.body")}{" "}
              <Link href="/privacy" className="underline underline-offset-2">{t("footer.privacy")}</Link>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => choose(false)}>{t("consent.decline")}</Button>
            <Button type="button" onClick={() => choose(true)}>{t("consent.accept")}</Button>
          </div>
        </div>
      )}
    </>
  );
}
