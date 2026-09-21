"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/lib/i18n/link";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export function LoginForm({ next }: { next: string | null }) {
  const router = useLocaleRouter();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Only an unverified email gets its own message (the customer needs to know what to do);
      // everything else stays generic so the form never reveals whether an address has an account.
      setError(signInError.code === "email_not_confirmed" ? t("auth.notVerified") : t("auth.loginError"));
      setLoading(false);
      return;
    }

    // Admin accounts land in the admin dashboard automatically; everyone
    // else goes to their account.
    const isAdmin = data.user.app_metadata?.role === "admin";
    router.push(isAdmin ? "/admin" : (next ?? "/account"));
    router.refresh();
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/40 p-(--space-sm)">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle as="h1" className="text-xl">{t("auth.loginTitle")}</CardTitle>
          <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-(--space-sm)">
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="mt-1 w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("auth.loginButton")}
            </Button>
          </form>

          <p className="mt-(--space-sm) text-center text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline">
              {t("auth.forgot")}
            </Link>
          </p>
          <p className="mt-(--space-xs) text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t("auth.signUpLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
