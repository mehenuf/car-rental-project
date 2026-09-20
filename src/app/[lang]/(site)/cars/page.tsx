import { getT } from "@/lib/i18n/dictionary";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CarsPageContent } from "@/components/site/cars-page-content";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return pageMetadata("/cars", { title: t("meta.cars") });
}

function CarsPageFallback() {
  return (
    <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-lg)">
      <Skeleton className="h-9 w-64" />
      <div className="mt-(--space-md) grid grid-cols-1 gap-(--space-lg) lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div className="flex min-w-0 flex-col gap-(--space-md)">
          <div className="flex items-center justify-between gap-(--space-sm)">
            <Skeleton className="h-9 w-24 lg:hidden" />
            <Skeleton className="ms-auto h-9 w-52" />
          </div>
          <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  return (
    <Suspense fallback={<CarsPageFallback />}>
      <CarsPageContent searchParams={resolvedSearchParams} />
    </Suspense>
  );
}
