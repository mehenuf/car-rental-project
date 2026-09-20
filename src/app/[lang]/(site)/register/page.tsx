"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/lib/i18n/link";
import { useLocale, useLocaleRouter, useT } from "@/lib/i18n/provider";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useLocaleRouter();
  const t = useT();
  const locale = useLocale();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bc-lang": locale },
      body: JSON.stringify({ fullName, email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? t("auth.genericError"));
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

    router.push("/account");
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
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/40 p-(--space-sm)">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle as="h1" className="text-xl">{t("auth.registerTitle")}</CardTitle>
          <CardDescription>{t("auth.registerSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-(--space-sm)">
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
