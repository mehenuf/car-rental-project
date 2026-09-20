import { Skeleton } from "@/components/ui/skeleton";

export default function VehicleDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-lg)">
      <div className="grid grid-cols-1 gap-(--space-lg) lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="flex flex-col gap-(--space-lg)">
          <div className="flex flex-col gap-(--space-xs)">
            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="size-16 shrink-0 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-(--space-sm)">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-28" />
            </div>

            <div className="grid grid-cols-2 gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="size-5 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>

            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />

            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-24" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-24">
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
