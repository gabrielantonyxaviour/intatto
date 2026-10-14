"use client"

import type { AccountState, MarketState, ProtocolParams } from "@/lib/chain"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DefinitionPopover, EvidenceSheet } from "@/components/ui/ix"
import { SessionSchedule } from "./session-schedule"
import { ContractsSheet } from "./contracts-sheet"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ValueChange } from "@/components/ui/web3"
import { formatTokenAmount } from "@/components/ui/web3/format"
import { GapTable } from "./gap-table"
import { health, liqPrice, pct, usdg } from "./format"
import { useNames } from "./names"
import { dropToLiquidation, type Metrics } from "./math"

type Props = {
  m: MarketState
  a: AccountState | null
  connected: boolean
  /** Connected, but the account read has not come back yet. */
  loading?: boolean
  before: Metrics
  /** The position after the draft on the active tab; null when nothing is typed. */
  after: Metrics | null
  /** GapReserve balance (MarketLens.vault.reserveBalance), for the lender-loss estimate. */
  reserveUsdg: bigint
  penaltyBps?: bigint
  params?: ProtocolParams
}

const num = (v: number | bigint) => BigInt(v)

/** Every position number as before → after (Morpho/Aave), then the Monday-gap stress table. */
export function PositionPanel({ m, a, connected, loading, before, after, reserveUsdg, penaltyBps, params }: Props) {
  const names = useNames()
  const multiplier = formatTokenAmount(m.assetsPerShare, 18, { maxFractionDigits: 4, minFractionDigits: 4 })
  const hasPosition = before.shares > 0n || before.debt > 0n
  const shown = after ?? before
  const buffer = dropToLiquidation(shown, m.liquidationThresholdBps)

  return (
    <Card data-testid="position-panel" className="min-w-0 shadow-none">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Your position</CardTitle>
          {after ? <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Current → after</span> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!connected ? (
          <p className="text-sm text-muted-foreground" data-testid="position-not-connected">
            Connect a wallet to see your position.
          </p>
        ) : loading ? (
          <div aria-busy="true" aria-label="Loading your position" className="grid gap-2">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : !a ? (
          <p role="status" className="text-sm text-muted-foreground">Your position is unavailable. Retry the account read above.</p>
        ) : !hasPosition && !after ? (
          <div className="grid gap-2 py-5 text-sm" data-testid="position-empty">
            <p className="text-lg font-medium">No position yet</p>
            <p className="text-muted-foreground">
              {a && a.walletToken > 0n
                ? `Your wallet holds ${names.tokens(a.walletToken)}. Deposit some to start.`
                : `Your wallet holds no ${names.token}. Get ${names.token} on X Layer first, or try the sandbox.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div className="grid gap-1 border-b pb-5 sm:col-span-2">
              <p className="text-xs text-muted-foreground">{after ? "Debt after this change" : "Outstanding debt"}</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{usdg(shown.debt)}</p>
              <p className="text-xs text-muted-foreground">{buffer === null ? "No debt, no liquidation risk." : buffer === 0 ? "At or above the liquidation threshold." : `${(buffer * 100).toFixed(2)}% price drop to liquidation.`}</p>
            </div>
            <Row id="position-collateral" label="Collateral" before={before.assets} after={after?.assets} format={(v) => names.tokens(num(v))} />
            <Row id="position-value" label="Collateral value" before={before.valueUsdg} after={after?.valueUsdg} format={(v) => usdg(num(v))} />
            <Row id="position-debt" label="Debt" before={before.debt} after={after?.debt} format={(v) => usdg(num(v))} />
            <Row
              id="position-ltv"
              label="LTV"
              before={before.ltvBps}
              after={after?.ltvBps}
              format={(v) => pct(num(v))}

              danger={after ? after.ltvBps > m.maxLtvBps && after.debt > before.debt : false}
            />
            <Row id="position-health" label="Health factor" before={before.healthE18} after={after?.healthE18} format={(v) => health(num(v))} />
            <Row
              id="position-liq-price"
              label="Liquidation price"
              before={before.liquidationPriceE18}
              after={after?.liquidationPriceE18}
              format={(v) => liqPrice(num(v))}
            />
          </div>
        )}

        <SessionSchedule m={m} params={params} />

        {connected && a && !loading && (hasPosition || after) ? (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">A Monday price gap can liquidate your collateral; losses beyond the reserve fall to lenders.</p>
            <details className="grid gap-2">
              <summary className="cursor-pointer text-sm font-medium">Monday gap scenarios</summary>
              <div className="pt-3">
                {after ? <p className="mb-2 text-xs text-muted-foreground">After this change</p> : null}
                <GapTable position={shown} m={m} reserveUsdg={reserveUsdg} penaltyBps={penaltyBps} />
              </div>
            </details>
          </>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 [&>button]:h-auto [&>button]:rounded-none [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-xs [&>button]:text-muted-foreground [&>button]:shadow-none [&>button]:underline [&>button]:underline-offset-4">
          <EvidenceSheet title={`${names.token} collateral details`} triggerLabel="Collateral details"
            summary="Active-chain MarketLens account and wrapper conversion reads. Values refresh independently."
            state={loading ? "fetching" : connected && !a ? "unavailable" : "ready"}>
            <div className="grid gap-3">
              <p>1 {names.wrapper} = {multiplier} {names.token} (issuer multiplier).</p>
              <p className="text-sm text-muted-foreground">Collateral is held as wrapper shares. Value = converted token assets × relayed price; the multiplier is not applied twice.</p>
              <p className="text-xs break-all">Raw assets per share (18 decimals): {m.assetsPerShare.toString()}</p>
              {a ? <>
                <Row id="position-shares" label="Held as" before={before.shares} after={after?.shares} format={(v) => names.shares(num(v))} />
                <p className="text-xs break-all">Raw wrapper shares (18 decimals): {before.shares.toString()}</p>
                <p className="text-xs break-all">Raw token assets (18 decimals): {before.assets.toString()}</p>
              </> : <p>Connect a wallet to see your collateral shares.</p>}
            </div>
          </EvidenceSheet>
          <ContractsSheet />
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  id,
  label,
  before,
  after,
  format,
  danger,
}: {
  id: string
  label: string
  before: bigint
  after: bigint | undefined
  format: (v: number | bigint) => string
  danger?: boolean
}) {
  return (
    <div className="min-w-0 py-3" data-testid={id} data-before={before.toString()}>
      {(label === "LTV" || label === "Health factor" || label === "Liquidation price") && <span className="float-right -mt-1">
        <DefinitionPopover term={label}>
          {label === "LTV" ? "Debt divided by collateral value, expressed as a percentage." : label === "Health factor" ? "Collateral value at the liquidation threshold divided by debt. Below 1 means the position can be liquidated." : "The collateral price at which this position reaches the liquidation threshold. It changes as debt accrues."}
        </DefinitionPopover>
      </span>}
      <ValueChange label={label} before={before} after={after === undefined || after === before ? null : after} format={format} danger={danger} className="flex-col items-start gap-1.5 [&>span:last-child]:flex-wrap [&>span:last-child]:text-base" />
    </div>
  )
}
