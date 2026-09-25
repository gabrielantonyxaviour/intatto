"use client"

import type { AccountState, MarketState } from "@/lib/chain"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ValueChange } from "@/components/ui/web3"
import { formatTokenAmount } from "@/components/ui/web3/format"
import { GapTable } from "./gap-table"
import { health, liqPrice, nvdax, pct, usdg, wnvdax } from "./format"
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
}

const num = (v: number | bigint) => BigInt(v)

/** Every position number as before → after (Morpho/Aave), then the Monday-gap stress table. */
export function PositionPanel({ m, a, connected, loading, before, after }: Props) {
  const multiplier = formatTokenAmount(m.assetsPerShare, 18, { maxFractionDigits: 4, minFractionDigits: 4 })
  const hasPosition = before.shares > 0n || before.debt > 0n
  const shown = after ?? before

  return (
    <Card data-testid="position-panel">
      <CardHeader>
        <CardTitle>Your position</CardTitle>
        <CardDescription>
          1 wNVDAx = {multiplier} NVDAx (issuer multiplier). Collateral is held as wNVDAx and valued at the relayed price.
        </CardDescription>
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
        ) : !hasPosition && !after ? (
          <div className="grid gap-1 text-sm" data-testid="position-empty">
            <p>No position yet.</p>
            <p className="text-muted-foreground">
              {a && a.walletToken > 0n
                ? `Your wallet holds ${nvdax(a.walletToken)}. Deposit some to start.`
                : "Your wallet holds no NVDAx. Get NVDAx on X Layer first, or try the sandbox."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            <Row id="position-collateral" label="Collateral" before={before.assets} after={after?.assets} format={(v) => nvdax(num(v))} good="up" />
            <Row id="position-shares" label="Held as" before={before.shares} after={after?.shares} format={(v) => wnvdax(num(v))} />
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

        {connected && !loading && (hasPosition || after) ? (
          <>
            <Separator />
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">
                If NVDA opens lower on Monday{after ? " (after this change)" : ""}
              </h3>
              <GapTable position={shown} m={m} />
            </div>
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
      <ValueChange label={label} before={before} after={after === undefined || after === before ? null : after} format={format} goodDirection={good} danger={danger} />
    </div>
  )
}
