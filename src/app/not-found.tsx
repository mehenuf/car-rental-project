import Link from "next/link";
import { Car } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * The root-level 404 — reached only when the unmatched URL doesn't fall
 * under any existing segment (so `(site)/not-found.tsx` and a would-be
 * admin one never get a chance to render). No header/footer/sidebar chrome
 * exists at this level, so this page stands entirely on its own.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-(--space-md) bg-background px-(--space-sm) py-(--space-2xl) text-center">
      <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
        <Car className="size-6 text-accent" />
        BestCar
      </Link>
      <div className="flex flex-col gap-2">
        <span className="font-heading text-6xl font-extrabold text-accent">404</span>
        <h1 className="font-heading text-2xl font-bold text-foreground">Page not found</h1>
        <p className="max-w-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        Back to homepage
      </Link>
    </div>
  );
}
