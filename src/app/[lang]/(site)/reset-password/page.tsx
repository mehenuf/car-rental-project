"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MIN_PASSWORD_LENGTH } from "@/lib/account/password";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";
import { supabase } from "@/lib/supabase";

/** The emailed link signs the visitor in briefly; this page lets them choose a new password. */
export default function ResetPasswordPage() {
  const t = useT();
  const router = useLocaleRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setReady(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/account"), 1200);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/40 p-(--space-sm)">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle as="h1" className="text-xl">{t("auth.resetTitle")}</CardTitle>
          {done && <CardDescription>{t("auth.resetDone")}</CardDescription>}
          {ready === false && <CardDescription>{t("auth.resetInvalid")}</CardDescription>}
        </CardHeader>
        {ready && !done && (
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-(--space-sm)">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{t("auth.newPassword")}</Label>
                <Input id="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
                <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {t("auth.savePassword")}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
