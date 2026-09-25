"use client"

import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react"
import type { MarketState, VaultState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RiskMeter, riskLevel } from "@/components/ui/web3"
import { formatTokenAmount } from "@/components/ui/web3/format"
import { liqPrice, pct, usdg } from "./format"
import { RISK_LEVELS, bpsToFraction, dropToLiquidation, yearlyInterest, type Metrics } from "./math"
import type { Chip } from "./plan"

const DOT = { Low: "bg-success", Medium: "bg-warning", High: "bg-destructive" } as const

/** Preset loans at fixed risk levels (Liquity's chips), each coloured by the risk it lands on. */
export function LoanChips({ chips, session, maxLtvBps, onPick }: {
  chips: Chip[]
  session: string
  maxLtvBps: bigint
  onPick: (amount: bigint) => void
}) {
  const shown = chips.filter((c) => c.amount >= 1_000_000n)
  if (shown.length === 0) return null
  return (
    <div role="group" aria-label="Preset loans by risk level" className="flex flex-wrap gap-1.5">
      {shown.map((c) => {
        const level = riskLevel(bpsToFraction(c.ltvBps), RISK_LEVELS)
        return (
          <Button
            key={c.level}
            type="button"
            variant="outline"
            size="xs"
            disabled={c.overLimit}
            title={c.overLimit ? `Above the ${session} session's ${pct(maxLtvBps)} limit` : `${pct(c.ltvBps)} LTV`}
            aria-label={`${c.level} risk: borrow ${usdg(c.amount)} (${pct(c.ltvBps)} LTV)${c.overLimit ? ", above the session limit" : ""}`}
            onClick={() => onPick(c.amount)}
          >
            <span aria-hidden className={cn("size-2 rounded-full", DOT[level])} />
            {formatTokenAmount(c.amount, 6, { maxFractionDigits: c.amount >= 10_000_000n ? 0 : 2 })} USDG
          </Button>
        )
      })}
    </div>
  )
}

/** Consequence lines under the loan field: LTV with its risk label, liquidation price and distance to it. */
export function LoanLine({ m, before, after, previewing }: {
  m: MarketState
  before: Metrics
  after: Metrics
  previewing: boolean
}) {
  const lt = m.liquidationThresholdBps
  const drop = dropToLiquidation(after, lt)
  const aboveSpot = after.liquidationPriceE18 > 0n && after.liquidationPriceE18 >= m.priceE18
  return (
    <div className="grid gap-2" data-testid="loan-line">
      <RiskMeter
        ltv={before.debt > 0n ? bpsToFraction(before.ltvBps) : null}
        projectedLtv={previewing && after.debt > 0n ? bpsToFraction(after.ltvBps) : undefined}
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
              : `NVDA can fall ${(drop * 100).toFixed(1)}% before liquidation`}
        </span>
      </div>
    </div>
  )
}

/** The rate panel: Intatto's rate is variable (no manual mode), so the menu explains it instead. */
export function RateRow({ v, debtAfter }: { v: VaultState; debtAfter: bigint }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Interest rate</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="xs">
              Variable <ChevronDownIcon aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="grid w-72 gap-2 text-sm">
            <p className="font-medium">Variable rate</p>
            <p className="text-muted-foreground">
              Set by how much of the lending vault is lent out (now {pct(v.utilizationBps)}). It moves as people borrow and
              repay; there is no fixed or manual rate. 20% of the interest funds the gap reserve.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-2xl font-medium tabular-nums" data-testid="borrow-rate">
        {pct(v.borrowRateBps)}
      </p>
      <p className="text-xs text-muted-foreground">
        {debtAfter > 0n ? `≈ ${usdg(yearlyInterest(debtAfter, v.borrowRateBps))} / year on ${usdg(debtAfter)} at today's rate` : "– USDG / year"}
      </p>
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
  const drop = dropToLiquidation(after, lt)
  return (
    <div className="grid gap-3" data-testid="risk-ack">
      <Alert variant="destructive">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>High liquidation risk</AlertTitle>
        <AlertDescription>
          After this loan your LTV is {pct(after.ltvBps)}.
          {drop !== null ? ` If NVDA opens ${(drop * 100).toFixed(1)}% lower after a weekend, this position can be liquidated with a 5% penalty.` : null}
        </AlertDescription>
      </Alert>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />I accept the liquidation risk of this loan
      </label>
    </div>
  )
}
