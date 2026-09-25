"use client"

import { useIntatto } from "@/lib/chain"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

const LABEL = {
  live: { long: "X Layer mainnet", short: "X Layer" },
  sandbox: { long: "X Layer mainnet fork", short: "Fork" },
} as const

/** Network context for the shell. The short label is what fits beside the wallet on a phone. */
export function ChainBadge() {
  const { hydrated, mode } = useIntatto()
  if (!hydrated) return <Skeleton className="h-5 w-16 shrink-0" aria-hidden />
  const label = mode === "sandbox" ? LABEL.sandbox : LABEL.live
  return (
    <Badge
      data-testid="chain-badge"
      data-mode={mode}
      variant={mode === "sandbox" ? "warning-light" : "outline"}
      size="lg"
      title={label.long}
      aria-label={label.long}
      className="shrink-0"
    >
      <span data-testid="chain-badge-short" className="sm:hidden">
        {label.short}
      </span>
      <span data-testid="chain-badge-long" className="hidden sm:inline">
        {label.long}
      </span>
    </Badge>
  )
}
