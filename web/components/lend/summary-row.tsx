import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** One label/value line in a panel summary or a configuration list. */
export function SummaryRow({
  label,
  children,
  className,
  testId,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
  testId?: string
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline justify-between gap-3 text-sm", className)}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd data-testid={testId} className="min-w-0 text-right tabular-nums break-words">
        {children}
      </dd>
    </div>
  )
}
