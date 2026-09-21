"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/lib/i18n/link";
import { useLocale, useLocaleRouter, useT } from "@/lib/i18n/provider";
import { Building2, CarFront, Loader2, MailCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AccountType = "renter" | "individual" | "company";

const ACCOUNT_TYPES: { value: AccountType; icon: typeof User; titleKey: string; bodyKey: string }[] = [
  { value: "renter", icon: CarFront, titleKey: "auth.typeRenter", bodyKey: "auth.typeRenterBody" },
  { value: "individual", icon: User, titleKey: "auth.typeOwner", bodyKey: "auth.typeOwnerBody" },
  { value: "company", icon: Building2, titleKey: "auth.typeCompany", bodyKey: "auth.typeCompanyBody" },
];

export function RegisterForm({ initialType }: { initialType: AccountType }) {
  const router = useLocaleRouter();
  const t = useT();
  const locale = useLocale();
  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError(t("auth.nameRequired"));
      return;
    }
    setLoading(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bc-lang": locale },
      body: JSON.stringify({ fullName, email, password, accountType }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string; issues?: { message: string }[] } }
        | null;
      // The server answers "Invalid request" plus the reason for each field; show the reasons.
      const reasons = body?.error?.issues?.map((issue) => issue.message).join(" ");
      setError(reasons || body?.error?.message || t("auth.genericError"));
      setLoading(false);
      return;
    }

    const result = (await response.json().catch(() => null)) as { needsVerification?: boolean } | null;
    if (result?.needsVerification) {
      // The customer must click the emailed link before signing in.
      setSentTo(email);
      setLoading(false);
      return;
    }

    // Pre-confirmed accounts (demo mode without an email provider) sign in straight away.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(t("auth.autoSignInFailed"));
      setLoading(false);
      return;
    }

    // Renters go to their account; owners and companies go on to tell us about their cars and branches.
    router.push(accountType === "renter" ? "/account" : `/provider/apply?type=${accountType}`);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/40 p-(--space-sm)">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <MailCheck className="size-8 text-accent-text" aria-hidden />
            <CardTitle as="h1" className="text-xl">{t("auth.verifyTitle")}</CardTitle>
            <CardDescription>{t("auth.verifyBody", { email: sentTo })}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-(--space-xs) text-center">
            <p className="text-sm text-muted-foreground">{t("auth.verifySpam")}</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => setSentTo(null)}>
              {t("auth.verifyWrong")}
            </Button>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              {t("auth.verifyBack")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/40 p-(--space-sm)">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <CardTitle as="h1" className="text-xl">{t("auth.registerTitle")}</CardTitle>
          <CardDescription>{t("auth.registerSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-(--space-sm)">
            <div role="radiogroup" aria-label={t("auth.accountType")} className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">{t("auth.accountType")}</span>
              {ACCOUNT_TYPES.map(({ value, icon: Icon, titleKey, bodyKey }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={accountType === value}
                  disabled={loading}
                  onClick={() => setAccountType(value)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-start transition-colors",
                    accountType === value ? "border-accent bg-accent/10 ring-2 ring-accent/30" : "border-input hover:border-accent"
                  )}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent-text">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{t(titleKey)}</span>
                    <span className="text-xs text-muted-foreground">{t(bodyKey)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">{t("auth.fullName")}</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                aria-describedby="password-hint"
              />
              <p id="password-hint" className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="mt-1 w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("auth.signUpButton")}
            </Button>
          </form>

          <p className="mt-(--space-sm) text-center text-xs text-muted-foreground">
            {t("auth.legalNotice", { terms: "terms", privacy: "privacy" })
              .split("")
              .map((part, index) =>
                part === "terms" ? (
                  <Link key={index} href="/terms" className="font-medium text-primary hover:underline">{t("meta.terms")}</Link>
                ) : part === "privacy" ? (
                  <Link key={index} href="/privacy" className="font-medium text-primary hover:underline">{t("meta.privacy")}</Link>
                ) : (
                  part
                )
              )}
          </p>

          <p className="mt-(--space-sm) text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("auth.logInLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
