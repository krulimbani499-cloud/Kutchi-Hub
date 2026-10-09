import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as BusinessCard: 4:3 photo, title row, text lines, info lines, three buttons. */
export function BusinessCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-10" />
        </div>
        <Skeleton className="mb-2 h-3.5 w-1/3" />
        <Skeleton className="mb-1.5 h-3.5 w-full" />
        <Skeleton className="mb-3 h-3.5 w-4/5" />
        <div className="mt-auto space-y-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div className="mt-4 flex gap-1.5 sm:gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </div>
    </div>
  );
}

export function BusinessCardSkeletonGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={className ?? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {Array.from({ length: count }, (_, i) => (
        <BusinessCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Default pending state for any route: heading bar, a few content blocks, then cards. */
export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="mx-auto min-h-[70vh] max-w-7xl px-4 py-6">
      <Skeleton className="mb-3 h-8 w-56" />
      <Skeleton className="mb-1.5 h-4 w-full max-w-2xl" />
      <Skeleton className="mb-6 h-4 w-2/3 max-w-xl" />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
      <BusinessCardSkeletonGrid count={4} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" />
    </div>
  );
}

/** Pending state for search / category / city pages: search-form-shaped block plus cards. */
export function ListingPageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="mx-auto min-h-[70vh] max-w-7xl px-4 py-6">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <Skeleton className="h-10 md:col-span-2" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 w-full sm:w-48" />
          <Skeleton className="h-10 w-full sm:w-40" />
        </div>
      </div>
      <BusinessCardSkeletonGrid count={4} />
    </div>
  );
}
