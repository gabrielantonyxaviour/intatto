"use client"

import { useState } from "react"
import type { Deployment, MarketDeployment } from "@intatto/config/deployments"
import { useProtocolParams, type MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { CapUsage } from "./cap-usage"
import { ContractsCard } from "./contracts-card"
import { DetailHeader } from "./detail-header"
import { GuardList } from "./guard-list"
import { marketTerms } from "./market-terms"
import { PriceEvidence } from "./price-panel"
import { SessionPanel, SessionSchedule } from "./session-panel"
import { YourInfo } from "./your-info"
import { useChainNow, useRelayDetail } from "./use-market-params"

type Tab = "overview" | "you"

/**
 * One market in full. Wide screens show the overview with Your info beside it; phones split them into
 * Overview and Your info tabs.
 */
export function MarketDetail({ deployment, market, state }: { deployment: Deployment; market: MarketDeployment; state: MarketState }) {
  const [tab, setTab] = useState<Tab>("overview")
  const params = useProtocolParams(market.symbol)
  const terms = params.status === "success" ? marketTerms(params.data) : undefined
  const relay = useRelayDetail(market.symbol)
  const now = useChainNow()

  return (
    <section id="market-detail" aria-labelledby="market-detail-title" data-testid={`market-detail-${market.symbol}`} className="grid scroll-mt-20 gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="lg:hidden">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="you">Your info</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div data-testid="tab-overview" className={cn("grid min-w-0 gap-5 rounded-xl border p-4 sm:p-6 lg:col-span-2", tab !== "overview" && "hidden lg:grid")}>
          <DetailHeader market={market} state={state} terms={terms} now={now.data} />
          <SessionPanel symbol={market.symbol} state={state} terms={terms} now={now.data} />
          {now.data !== undefined ? (
            <GuardList symbol={market.symbol} state={state} relay={relay.data} relayFailed={relay.isError} now={now.data} terms={terms} />
          ) : (
            <Skeleton className="h-24" />
          )}
          <CapUsage symbol={market.symbol} state={state} />
          <div className="flex flex-wrap items-center gap-1 border-t pt-3 [&_button[data-slot=sheet-trigger]]:border-transparent [&_button[data-slot=sheet-trigger]]:bg-transparent [&_button[data-slot=sheet-trigger]]:text-xs [&_button[data-slot=sheet-trigger]]:text-muted-foreground">
            <span className="mr-1 text-xs text-muted-foreground">More</span>
            <SessionSchedule params={params.data} />
            <PriceEvidence symbol={market.symbol} state={state} terms={terms} />
            <ContractsCard deployment={deployment} market={market} state={state} />
          </div>
        </div>
        <div data-testid="tab-you" className={cn("min-w-0 lg:sticky lg:top-20", tab !== "you" && "hidden lg:block")}>
          <YourInfo symbol={market.symbol} market={state} />
        </div>
      </div>
    </section>
  )
}
