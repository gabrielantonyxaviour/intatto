"use client"

import { TriangleAlertIcon } from "lucide-react"
import { useProtocolParams, type MarketState, type VaultState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DefinitionPopover } from "@/components/ui/ix"
import { RISK_LEVELS, RiskMeter, riskLevel } from "@/components/ui/web3"
import { formatTokenAmount } from "@/components/ui/web3/format"
import { capacityUsdg, liqPrice, pct, usdg } from "./format"
import { bpsToFraction, dropToLiquidation, yearlyInterest, type Metrics } from "./math"
import { useNames } from "./names"
import type { Chip, Refusal } from "./plan"

const DOT = { Low: "bg-success", Medium: "bg-warning", High: "bg-destructive" } as const

/**
 * Preset loans at fixed risk levels (Liquity's chips), each coloured by the risk it lands on, and Max. All of them
 * follow the refusal in force now: when no borrow can go through, they are disabled and say why.
 */
export function LoanChips({ chips, session, maxLtvBps, fill, capacity, refusal, onPick }: {
  chips: Chip[]
  session: string
  maxLtvBps: bigint
  /** What Max fills (the lens capacity less the accrual margin). */
  fill: bigint
  /** Lens borrow capacity, shown on the Max hint with all 6 USDG decimals. */
  capacity: bigint
  refusal: Refusal | null
  onPick: (amount: bigint) => void
}) {
  const shown = chips.filter((c) => c.amount >= 1_000_000n)
  const why = refusal ? `${refusal.label}: ${refusal.reason}` : null
  return (
    <div role="group" aria-label="Preset loans by risk level" className="flex flex-wrap gap-1.5">
      {shown.map((c) => {
        const level = riskLevel(bpsToFraction(c.ltvBps), RISK_LEVELS)
        const blocked = refusal !== null || c.overLimit
        return (
          <Button
            key={c.level}
            type="button"
            variant="outline"
            size="xs"
            disabled={blocked}
            title={why ?? (c.overLimit ? `Above the ${session} session's ${pct(maxLtvBps)} limit` : `${pct(c.ltvBps)} LTV`)}
            aria-label={`${c.level} risk: borrow ${usdg(c.amount)} (${pct(c.ltvBps)} LTV)${blocked ? `, unavailable: ${refusal?.label ?? "above the session limit"}` : ""}`}
            onClick={() => onPick(c.amount)}
          >
            <span aria-hidden className={cn("size-2 rounded-full", DOT[level])} />
            {formatTokenAmount(c.amount, 6, { maxFractionDigits: c.amount >= 10_000_000n ? 0 : 2 })} USDG
          </Button>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={refusal !== null || fill === 0n}
        title={why ?? `Borrow ${capacityUsdg(capacity)}`}
        aria-label={refusal ? `Max, unavailable: ${refusal.label}` : "Max"}
        onClick={() => onPick(fill)}
      >
        Max
      </Button>
    </div>
  )
}

/** Shown under the loan field while no new borrow can go through, whatever the amount. */
export function RefusedNow({ refusal }: { refusal: Refusal }) {
  return (
    <p className="text-xs text-destructive" data-testid="loan-refused-now">
      New borrowing is refused right now: {refusal.label}. {refusal.reason}
    </p>
  )
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
              : `${underlying} can fall ${(drop * 100).toFixed(1)}% before liquidation`}
        </span>
      </div>
    </div>
  )
}

/** The rate panel: Intatto's rate is variable (no manual mode), so the menu explains it instead. */
export function RateRow({ v, debtAfter }: { v: VaultState; debtAfter: bigint }) {
  const { symbol } = useNames()
  const { data: params } = useProtocolParams(symbol)
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Interest rate</span>
        <span className="inline-flex items-center text-xs">Variable
          <DefinitionPopover term="variable rate" source={params ? `Reserve factor read at block ${params.blockNumber}` : undefined}>
            Set by vault utilisation (now {pct(v.utilizationBps)}); changes as people borrow and repay.
            {params ? ` ${pct(params.market.reserveFactorBps)} of interest funds the gap reserve.` : " Reserve allocation unavailable or loading."}
          </DefinitionPopover>
        </span>
      </div>
      <p className="text-2xl font-medium tabular-nums" data-testid="borrow-rate">
        {pct(v.borrowRateBps)}
      </p>
      <p className="text-xs text-muted-foreground">
        {debtAfter > 0n ? `≈ ${usdg(yearlyInterest(debtAfter, v.borrowRateBps))} / year on ${usdg(debtAfter)} at today's rate (estimate)` : "– USDG / year"}
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
