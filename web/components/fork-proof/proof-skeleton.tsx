import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder for the report until the chain mode and URL parameters are known. */
export function ProofSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the fork proof" className="mx-auto grid w-full max-w-4xl gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}
