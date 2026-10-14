"use client"

import { TriangleAlertIcon } from "lucide-react"
import { useProtocolParams, type MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RISK_LEVELS, RiskMeter } from "@/components/ui/web3"
import { liqPrice, pct, usdg } from "./format"
import { bpsToFraction, dropToLiquidation, type Metrics } from "./math"
import { useNames } from "./names"
import { RefusalCard } from "./refusal-card"
import type { Refusal } from "./plan"

/** Capacity fractions use the existing capped, accrual-adjusted maximum. */
export function LoanChips({ fill, capacity, refusal, onPick }: {
  fill: bigint
  capacity: bigint
  refusal: Refusal | null
  onPick: (amount: bigint) => void
}) {
  return <div role="group" aria-label="Borrow capacity presets" className="flex flex-wrap gap-1.5">
    {[25, 50, 75, 100].map((percent) => {
      const amount = percent === 100 ? fill : capacity * BigInt(percent) / 100n
      return <Button key={percent} type="button" variant="outline" size="xs"
        disabled={refusal !== null || amount === 0n}
        title={refusal ? `${refusal.label}: ${refusal.reason}` : `Borrow ${usdg(amount)}`}
        onClick={() => onPick(amount)}>{percent === 100 ? "Max" : `${percent}%`}</Button>
    })}
  </div>
}

export function RefusedNow({ refusal }: { refusal: Refusal }) {
  return <RefusalCard reason={refusal.reason} code={refusal.name} />
}

/** Consequence lines under the loan field: LTV with its risk label, liquidation price and distance to it. */
export function LoanLine({ m, before, after, previewing }: {
  m: MarketState
  before: Metrics
  after: Metrics
  previewing: boolean
}) {
  const { underlying } = useNames()
  const lt = m.liquidationThresholdBps
  const drop = dropToLiquidation(after, lt)
  const aboveSpot = after.liquidationPriceE18 > 0n && after.liquidationPriceE18 >= m.priceE18
  return (
    <div className="grid gap-2" data-testid="loan-line">
      <RiskMeter
        ltv={before.debt > 0n ? bpsToFraction(before.ltvBps) : null}
        projectedLtv={previewing ? bpsToFraction(after.ltvBps) : undefined}
        maxLtv={bpsToFraction(m.maxLtvBps)}
        liquidationThreshold={bpsToFraction(lt)}
        levels={RISK_LEVELS}
        maxLtvLabel={`${m.session} max`}
        liquidationLabel="Liquidation"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Liquidation price{" "}
          <span className={cn("font-medium tabular-nums", aboveSpot ? "text-destructive" : "text-foreground")}>
            {after.debt > 0n ? liqPrice(after.liquidationPriceE18) : "–"}
          </span>
        </span>
        <span>
          {drop === null
            ? "No debt, no liquidation"
            : aboveSpot
              ? "Above today's price: liquidatable at once"
              : `${underlying} can fall ${(drop * 100).toFixed(1)}% before liquidation`}
        </span>
      </div>
    </div>
  )
}

/** Aave's pattern: a red callout and a checkbox that must be ticked before a high-LTV loan can be reviewed. */
export function RiskAck({ after, lt, checked, onChange }: {
  after: Metrics
  lt: bigint
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const { underlying, symbol } = useNames()
  const { data: params } = useProtocolParams(symbol)
  const drop = dropToLiquidation(after, lt)
  return (
    <div className="grid gap-3" data-testid="risk-ack">
      <Alert variant="destructive">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>High liquidation risk</AlertTitle>
        <AlertDescription>
          After this loan your LTV is {pct(after.ltvBps)}.
          {drop !== null ? ` If ${underlying} opens ${(drop * 100).toFixed(1)}% lower after a weekend, this position can be liquidated with ${params ? `a ${pct(params.market.penaltyBps)} penalty` : "a liquidation penalty (rate unavailable)"}.` : null}
        </AlertDescription>
      </Alert>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />I accept the liquidation risk of this loan
      </label>
    </div>
  )
}
