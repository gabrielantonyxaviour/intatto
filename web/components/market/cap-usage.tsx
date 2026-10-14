import type { MarketState } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { bpsShort, usdgDisplay, usdgExact } from "./format"

export function CapUsage({ symbol, state: s }: { symbol: string; state: MarketState }) {
  const usedBps = s.capUsdg === 0n ? (s.totalDebt > 0n ? 10_000n : 0n) : (s.totalDebt * 10_000n) / s.capUsdg
  const percentage = Math.min(Number(usedBps) / 100, 100)
  return (
    <div data-testid="cap-usage" className="grid gap-2 border-t pt-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">Borrowing cap<DefinitionPopover term={`Borrowing cap for ${symbol}`}>The cap follows pool exit depth. Room left: {usdgExact(s.capUsdg > s.totalDebt ? s.capUsdg - s.totalDebt : 0n)}. {s.sliceUsdg > 0n ? `Closed-market liquidations sell at most ${usdgExact(s.sliceUsdg)} per slice.` : "No slice size posted; a closed-market liquidation cannot sell yet."}</DefinitionPopover></span>
        <span data-testid="cap-used" className="tabular-nums">{bpsShort(usedBps)} used</span>
      </div>
      <div role="progressbar" aria-label={`${symbol} borrowing cap used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${usdgDisplay(s.totalDebt)} of ${usdgDisplay(s.capUsdg)} used`} className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${percentage}%` }} />
      </div>
      <p title={`${usdgExact(s.totalDebt)} of ${usdgExact(s.capUsdg)}`} className="text-xs text-muted-foreground tabular-nums">{usdgDisplay(s.totalDebt)} of {usdgDisplay(s.capUsdg)} used</p>
    </div>
  )
}
