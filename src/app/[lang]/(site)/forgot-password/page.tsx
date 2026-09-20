"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLocale, useT } from "@/lib/i18n/provider";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const t = useT();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    // The answer is the same whether or not the address has an account.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${locale}/reset-password`,
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/40 p-(--space-sm)">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle as="h1" className="text-xl">{t("auth.forgotTitle")}</CardTitle>
          <CardDescription>{sent ? t("auth.forgotSent") : t("auth.forgotBody")}</CardDescription>
        </CardHeader>
        {!sent && (
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-(--space-sm)">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {t("auth.sendLink")}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
