"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Covers both /admin/login and everything under /admin/(protected) — the
 * nearest shared ancestor segment for the whole admin section. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="max-w-md text-muted-foreground">
          This part of the dashboard hit an error. Try again, or head back to the dashboard home.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
