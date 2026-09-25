import { Skeleton } from "@/components/ui/skeleton"

/** Stable placeholder rendered on the server and until the client knows whether it is in sandbox mode. */
export function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  )
}
