import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { formatTokenAmount } from "./format"

export type TokenAmountProps = {
  /** Base units. null/undefined renders `fallback`. */
  value: bigint | null | undefined
  decimals: number
  symbol?: ReactNode
  maxFractionDigits?: number
  minFractionDigits?: number
  fallback?: ReactNode
  className?: string
}

/** A bigint token amount formatted without float rounding: "1,234.5678 NVDAx". */
export function TokenAmount({
  value,
  decimals,
  symbol,
  maxFractionDigits = 4,
  minFractionDigits = 0,
  fallback = "–",
  className,
}: TokenAmountProps) {
  if (value === null || value === undefined) {
    return <span className={cn("tabular-nums text-muted-foreground", className)}>{fallback}</span>
  }
  return (
    <span data-slot="token-amount" className={cn("tabular-nums", className)}>
      {formatTokenAmount(value, decimals, { maxFractionDigits, minFractionDigits })}
      {symbol ? <> {symbol}</> : null}
    </span>
  )
}
