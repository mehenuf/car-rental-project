"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Covers every page of the host portal, so a render error shows this instead of the global error page. Same as
 * the admin one. */
export default function ProviderError({
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
          This part of the host portal hit an error. Try again, or head back to the portal home.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Link href="/provider" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Back to the portal
        </Link>
      </div>
    </div>
  );
}
