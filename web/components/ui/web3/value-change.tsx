import type { ReactNode } from "react"
import { ArrowRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber } from "./format"

type Num = number | bigint

export type ValueChangeProps = {
  label?: ReactNode
  before: Num | null | undefined
  /** Omit (or pass null) to show only the current value. */
  after?: Num | null
  format?: (value: Num) => string
  /** Which direction is better; colours the after value green or red. */
  goodDirection?: "up" | "down"
  /** Forces the after value red regardless of direction (e.g. above the limit). */
  danger?: boolean
  className?: string
}

/** "before → after", Morpho/Aave style, for one position number. */
export function ValueChange({
  label,
  before,
  after,
  format = formatNumber,
  goodDirection,
  danger,
  className,
}: ValueChangeProps) {
  const show = (v: Num | null | undefined) => (v === null || v === undefined ? "–" : format(v))
  const changed = after !== null && after !== undefined && before !== null && before !== undefined && after !== before
  let tone = ""
  if (danger) tone = "text-destructive"
  else if (changed && goodDirection) {
    const up = after! > before!
    tone = up === (goodDirection === "up") ? "text-success-foreground" : "text-destructive"
  }
  const hasAfter = after !== null && after !== undefined

  return (
    <div data-slot="value-change" className={cn("flex min-w-0 items-center justify-between gap-3 text-sm", className)}>
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className={cn(hasAfter && "text-muted-foreground")}>{show(before)}</span>
        {hasAfter ? (
          <>
            <ArrowRightIcon aria-label="becomes" className="size-3.5 text-muted-foreground" />
            <span className={cn("font-medium", tone)}>{show(after)}</span>
          </>
        ) : null}
      </span>
    </div>
  )
}
