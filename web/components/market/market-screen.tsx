"use client"

import { useState } from "react"
import type { Deployment } from "@intatto/config/deployments"
import { ChainReady, useIntatto, useMarketState, useVaultState, type MarketSymbol } from "@/lib/chain"
import { Skeleton } from "@/components/ui/skeleton"
import { HeadlineStats } from "./headline-stats"
import { MarketDetail } from "./market-detail"
import { MarketsTable, type MarketRow } from "./markets-table"
import { DetailSkeleton, LoadError, NotDeployed, StatsSkeleton } from "./states"

function Intro() {
  return (
    <header className="grid gap-1">
      <h1 className="text-2xl font-semibold">Market</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Borrow USDG against tokenized stocks on X Layer. How much you can borrow follows the US market session; the
        liquidation line stays put.
      </p>
    </header>
  )
}

function Loaded({ deployment }: { deployment: Deployment }) {
  const primary = deployment.markets[0]!.symbol
  const nvda = useMarketState("NVDAx")
  const spy = useMarketState("SPYx")
  const vault = useVaultState(primary)
  const [selected, setSelected] = useState<MarketSymbol>(primary)

  const queries = deployment.markets.map((m) => ({ market: m, query: m.symbol === "NVDAx" ? nvda : spy }))
  const failed = [vault, ...queries.map((q) => q.query)].find((q) => q.isError)
  if (failed) {
    return (
      <LoadError
        what="the market from the chain"
        error={failed.error}
        onRetry={() => {
          void vault.refetch()
          for (const q of queries) void q.query.refetch()
        }}
      />
    )
  }
  if (!vault.data || queries.some((q) => !q.query.data)) {
    return (
      <div className="grid gap-6">
        <StatsSkeleton />
        <Skeleton className="h-32" />
        <DetailSkeleton />
      </div>
    )
  }

  const rows: MarketRow[] = queries.map((q) => ({ deployment: q.market, state: q.query.data! }))
  const current = rows.find((r) => r.deployment.symbol === selected) ?? rows[0]!
  const select = (symbol: MarketSymbol) => {
    setSelected(symbol)
    requestAnimationFrame(() => document.getElementById("market-detail")?.scrollIntoView({ block: "start" }))
  }

  return (
    <div className="grid gap-8">
      <HeadlineStats vault={vault.data} markets={rows.map((r) => r.state)} />
      <MarketsTable rows={rows} vault={vault.data} selected={current.deployment.symbol} onSelect={select} />
      <MarketDetail key={current.deployment.symbol} deployment={deployment} market={current.deployment} state={current.state} />
    </div>
  )
}

function Screen() {
  const { deployment } = useIntatto()
  return (
    <div className="grid gap-6">
      <Intro />
      {deployment ? <Loaded deployment={deployment} /> : <NotDeployed />}
    </div>
  )
}

/** Route "/": the lending market, its session, limits and guards, per tokenized stock. */
export function MarketScreen() {
  // wagmi hooks (Your info) exist only once the chain mode is known on the client.
  return (
    <ChainReady fallback={<StatsSkeleton />}>
      <Screen />
    </ChainReady>
  )
}
