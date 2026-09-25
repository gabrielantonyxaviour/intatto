import { cn } from "@/lib/utils"
import { formatPercent } from "./format"

export type RiskLevel = "Low" | "Medium" | "High"

export type RiskMeterProps = {
  /** Current loan-to-value as a fraction (0.42 = 42%). null when there is no position. */
  ltv: number | null
  /** LTV after the action being previewed; the bar and label follow it when given. */
  projectedLtv?: number | null
  /** The borrowing limit for the current market session, as a fraction. */
  maxLtv: number
  /** LTV at which the position can be liquidated, as a fraction. */
  liquidationThreshold: number
  /** LTV fractions where the label turns Medium and High. */
  levels: { medium: number; high: number }
  maxLtvLabel?: string
  liquidationLabel?: string
  className?: string
}

/**
 * The one risk scale every Intatto screen uses, on the position's LTV (fractions): Medium from the weekend limit
 * (30%), High from 45%, well before the fixed 65% liquidation threshold. Session limits never change the label.
 */
export const RISK_LEVELS = { medium: 0.3, high: 0.45 } as const

export function riskLevel(ltv: number, levels: RiskMeterProps["levels"]): RiskLevel {
  if (ltv >= levels.high) return "High"
  if (ltv >= levels.medium) return "Medium"
  return "Low"
}

const tone: Record<RiskLevel, { bar: string; text: string }> = {
  Low: { bar: "bg-success", text: "text-success-foreground" },
  Medium: { bar: "bg-warning", text: "text-warning-foreground" },
  High: { bar: "bg-destructive", text: "text-destructive" },
}

const pct = (f: number) => `${Math.min(Math.max(f, 0), 1) * 100}%`

/** LTV bar with the session limit and liquidation threshold marked, after Aave's "Risk details" and Liquity's risk label. */
export function RiskMeter({
  ltv,
  projectedLtv,
  maxLtv,
  liquidationThreshold,
  levels,
  maxLtvLabel = "Session max LTV",
  liquidationLabel = "Liquidation",
  className,
}: RiskMeterProps) {
  const shown = projectedLtv ?? ltv
  const level = shown === null ? null : riskLevel(shown, levels)
  const showsChange = projectedLtv !== undefined && projectedLtv !== null && ltv !== null && projectedLtv !== ltv
  const valueText = (v: number) => (v > 1 ? ">100%" : formatPercent(v))

  return (
    <div data-slot="risk-meter" className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">LTV</span>
        <span className="flex items-center gap-2 tabular-nums">
          {showsChange ? <span className="text-muted-foreground">{valueText(ltv!)} →</span> : null}
          <span className={cn("font-medium", level && shown! >= maxLtv && "text-destructive")}>
            {shown === null ? "–" : valueText(shown)}
          </span>
          {level ? <span className={cn("text-xs font-medium", tone[level].text)}>{level}</span> : null}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Loan to value"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown === null ? 0 : Math.round(Math.min(shown, 1) * 10000) / 100}
        aria-valuetext={shown === null ? "No position" : `${valueText(shown)}, ${level} risk`}
        className="relative h-2 w-full rounded-full bg-muted"
      >
        {showsChange ? (
          <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/15" style={{ width: pct(ltv!) }} />
        ) : null}
        {shown !== null && level ? (
          <div className={cn("absolute inset-y-0 left-0 rounded-full", tone[level].bar)} style={{ width: pct(shown) }} />
        ) : null}
        <span
          title={`${maxLtvLabel} ${formatPercent(maxLtv)}`}
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: pct(maxLtv) }}
        />
        <span
          title={`${liquidationLabel} ${formatPercent(liquidationThreshold)}`}
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-destructive"
          style={{ left: pct(liquidationThreshold) }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 rounded-full bg-foreground" />
          {maxLtvLabel} {formatPercent(maxLtv)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 rounded-full bg-destructive" />
          {liquidationLabel} {formatPercent(liquidationThreshold)}
        </span>
      </div>
    </div>
  )
}
