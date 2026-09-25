"use client"

import type { AccountState, MarketState } from "@/lib/chain"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DefinitionPopover, EvidenceSheet } from "@/components/ui/ix"
import { ContractsSheet } from "./contracts-sheet"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ValueChange } from "@/components/ui/web3"
import { formatTokenAmount } from "@/components/ui/web3/format"
import { GapTable } from "./gap-table"
import { health, liqPrice, pct, usdg } from "./format"
import { useNames } from "./names"
import type { Metrics } from "./math"

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
}

const num = (v: number | bigint) => BigInt(v)

/** Every position number as before → after (Morpho/Aave), then the Monday-gap stress table. */
export function PositionPanel({ m, a, connected, loading, before, after, reserveUsdg, penaltyBps }: Props) {
  const names = useNames()
  const multiplier = formatTokenAmount(m.assetsPerShare, 18, { maxFractionDigits: 4, minFractionDigits: 4 })
  const hasPosition = before.shares > 0n || before.debt > 0n
  const shown = after ?? before

  return (
    <Card data-testid="position-panel">
      <CardHeader>
        <CardTitle>Your position</CardTitle>
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
          <div className="grid gap-1 text-sm" data-testid="position-empty">
            <p>No position yet.</p>
            <p className="text-muted-foreground">
              {a && a.walletToken > 0n
                ? `Your wallet holds ${names.tokens(a.walletToken)}. Deposit some to start.`
                : `Your wallet holds no ${names.token}. Get ${names.token} on X Layer first, or try the sandbox.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            <Row id="position-collateral" label="Collateral" before={before.assets} after={after?.assets} format={(v) => names.tokens(num(v))} good="up" />
            <Row id="position-value" label="Collateral value" before={before.valueUsdg} after={after?.valueUsdg} format={(v) => usdg(num(v))} good="up" />
            <Row id="position-debt" label="Debt" before={before.debt} after={after?.debt} format={(v) => usdg(num(v))} good="down" />
            <Row
              id="position-ltv"
              label="LTV"
              before={before.ltvBps}
              after={after?.ltvBps}
              format={(v) => pct(num(v))}
              good="down"
              danger={after ? after.ltvBps > m.maxLtvBps && after.debt > before.debt : false}
            />
            <Row id="position-health" label="Health factor" before={before.healthE18} after={after?.healthE18} format={(v) => health(num(v))} good="up" />
            <Row
              id="position-liq-price"
              label="Liquidation price"
              before={before.liquidationPriceE18}
              after={after?.liquidationPriceE18}
              format={(v) => liqPrice(num(v))}
              good="down"
            />
            <p className="text-xs text-muted-foreground">
              New-borrow limit {pct(m.maxLtvBps)} ({m.session}) · liquidation at {pct(m.liquidationThresholdBps)}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
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
  good,
  danger,
}: {
  id: string
  label: string
  before: bigint
  after: bigint | undefined
  format: (v: number | bigint) => string
  good?: "up" | "down"
  danger?: boolean
}) {
  return (
    <div data-testid={id} data-before={before.toString()}>
      {(label === "LTV" || label === "Health factor" || label === "Liquidation price") && <span className="float-right">
        <DefinitionPopover term={label}>
          {label === "LTV" ? "Debt divided by collateral value, expressed as a percentage." : label === "Health factor" ? "Collateral value at the liquidation threshold divided by debt. Below 1 means the position can be liquidated." : "The collateral price at which this position reaches the liquidation threshold. It changes as debt accrues."}
        </DefinitionPopover>
      </span>}
      <ValueChange label={label} before={before} after={after === undefined || after === before ? null : after} format={format} goodDirection={good} danger={danger} />
    </div>
  )
}
