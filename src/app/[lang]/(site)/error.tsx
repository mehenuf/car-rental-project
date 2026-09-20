"use client";

import { useEffect } from "react";
import { Link } from "@/lib/i18n/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("error.title")}</h1>
        <p className="text-muted-foreground">{t("error.body")}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => reset()}>
          {t("common.tryAgain")}
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {t("common.backHome")}
        </Link>
      </div>
    </div>
  );
}
