"use client"

import { useState } from "react"
import type { Deployment, MarketDeployment } from "@intatto/config/deployments"
import type { MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { CapUsage } from "./cap-usage"
import { ContractsCard } from "./contracts-card"
import { DetailHeader } from "./detail-header"
import { GuardList } from "./guard-list"
import { PricePanel } from "./price-panel"
import { SessionPanel } from "./session-panel"
import { YourInfo } from "./your-info"
import { useChainNow, useProtocolParams, useRelayDetail } from "./use-market-params"

type Tab = "overview" | "you"

/**
 * One market in full. Wide screens show the overview with Your info beside it; phones split them into
 * Overview and Your info tabs.
 */
export function MarketDetail({ deployment, market, state }: { deployment: Deployment; market: MarketDeployment; state: MarketState }) {
  const [tab, setTab] = useState<Tab>("overview")
  const params = useProtocolParams()
  const relay = useRelayDetail(market.symbol)
  const now = useChainNow()

  return (
    <section id="market-detail" aria-labelledby="market-detail-title" data-testid={`market-detail-${market.symbol}`} className="grid scroll-mt-20 gap-4">
      <DetailHeader market={market} state={state} relay={relay.data} params={params.data} now={now.data} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="lg:hidden">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="you">Your info</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div data-testid="tab-overview" className={cn("grid min-w-0 gap-4 lg:col-span-2", tab !== "overview" && "hidden lg:grid")}>
          <SessionPanel symbol={market.symbol} state={state} params={params.data} relay={relay.data} now={now.data} />
          {now.data !== undefined ? (
            <GuardList symbol={market.symbol} state={state} relay={relay.data} relayFailed={relay.isError} now={now.data} />
          ) : (
            <Skeleton className="h-56" />
          )}
          <CapUsage symbol={market.symbol} state={state} />
          <PricePanel symbol={market.symbol} state={state} relay={relay.data} />
          <ContractsCard deployment={deployment} market={market} state={state} />
        </div>
        <div data-testid="tab-you" className={cn("min-w-0 lg:sticky lg:top-20", tab !== "you" && "hidden lg:block")}>
          <YourInfo symbol={market.symbol} market={state} />
        </div>
      </div>
    </section>
  )
}
