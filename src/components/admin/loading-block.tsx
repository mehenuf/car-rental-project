import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows for an admin list that is still loading, so the page is not blank while the data arrives. */
export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">Loading...</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
