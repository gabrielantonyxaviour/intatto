import type { MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { bps, usdg } from "./format"

const R = 26
const C = 2 * Math.PI * R

/** Ticker cap usage as a ring: total debt against this stock out of the cap sized from pool exit depth. */
export function CapUsage({ symbol, state: s }: { symbol: string; state: MarketState }) {
  const usedBps = s.capUsdg === 0n ? (s.totalDebt > 0n ? 10_000n : 0n) : (s.totalDebt * 10_000n) / s.capUsdg
  const fraction = Math.min(Number(usedBps) / 10_000, 1)
  const tone = usedBps >= 10_000n ? "stroke-destructive" : usedBps >= 8_000n ? "stroke-warning" : "stroke-primary"
  return (
    <Card data-testid="cap-usage">
      <CardHeader>
        <CardTitle>Borrowing cap for {symbol}</CardTitle>
        <CardDescription>Total debt against {symbol} may not pass a cap the keeper sizes from what the pool can absorb in a sale.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="relative size-20 shrink-0">
          <svg viewBox="0 0 64 64" className="size-20 -rotate-90" role="img" aria-label={`${bps(usedBps)} of the cap used`}>
            <circle cx="32" cy="32" r={R} fill="none" strokeWidth="6" className="stroke-muted" />
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${C * fraction} ${C}`}
              className={cn(fraction === 0 ? "stroke-transparent" : tone)}
            />
          </svg>
          <span data-testid="cap-used" className="absolute inset-0 grid place-items-center text-xs font-medium tabular-nums">
            {bps(usedBps)}
          </span>
        </div>
        <div className="grid min-w-0 flex-1 gap-1 text-sm">
          <span className="font-medium tabular-nums">
            {usdg(s.totalDebt)} <span className="font-normal text-muted-foreground">of</span> {usdg(s.capUsdg)}
          </span>
          <span className="text-xs text-muted-foreground">
            Room left: {usdg(s.capUsdg > s.totalDebt ? s.capUsdg - s.totalDebt : 0n)}.{" "}
            {s.sliceUsdg > 0n
              ? `While the market is closed a liquidation slice sells at most ${usdg(s.sliceUsdg)}.`
              : "The keeper has not posted a slice size yet, so no liquidation slice can sell while the market is closed."}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
