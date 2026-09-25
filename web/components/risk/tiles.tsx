/** Headline number tiles: label, big value, one line of context and an optional small change note. */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export function Tile({
  label,
  value,
  sub,
  delta,
  testId,
  className,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  delta?: ReactNode
  testId?: string
  className?: string
}) {
  return (
    <div data-tile={testId} className={cn("grid min-w-0 content-start gap-1 rounded-xl border bg-card p-4", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span data-tile-value className="text-2xl font-semibold tabular-nums break-words">
        {value}
      </span>
      {delta ? <span className="text-xs tabular-nums">{delta}</span> : null}
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

export function TileSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-2 rounded-xl border bg-card p-4" aria-hidden>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </>
  )
}

export function TileGrid({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <div aria-busy={busy || undefined} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  )
}
