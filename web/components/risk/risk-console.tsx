"use client"

/**
 * The risk console: a public audit of what Intatto's contracts did, read straight from the chain. One market at a
 * time, one analysis at a time (after a risk dashboard's list of analyses), every row linked to its transaction.
 */
import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useAccount } from "wagmi"
import type { MarketDeployment } from "@intatto/config/deployments"
import { ChainReady, useIntatto } from "@/lib/chain"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { RiskDataProvider } from "./risk-data"
import { NotDeployed } from "./states"
import { GuardAlerts, ScanStatus, WalletNote } from "./status-bar"
import { useView, ViewNav, type ViewId } from "./view-nav"
import { SummaryView } from "./summary-view"
import { PricePostsView } from "./price-posts"
import { PriceShockView } from "./price-shock"
import { LoansView } from "./loans-view"
import { CapsView } from "./caps-view"
import { OverviewView } from "./overview-view"
import { SessionsView } from "./sessions-view"
import { ActionsView } from "./actions-view"
import { LiquidationsView } from "./liquidations-view"
import { KeeperLogView } from "./keeper-log"
import { TrustView } from "./trust-view"

const RENDER: Record<ViewId, () => ReactNode> = {
  summary: () => <SummaryView />,
  prices: () => <PricePostsView />,
  shock: () => <PriceShockView />,
  loans: () => <LoansView />,
  caps: () => <CapsView />,
  overview: () => <OverviewView />,
  sessions: () => <SessionsView />,
  actions: () => <ActionsView />,
  liquidations: () => <LiquidationsView />,
  keeper: () => <KeeperLogView />,
  trust: () => <TrustView />,
}

function ConsoleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the risk console" className="grid gap-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}

function Header({ markets, symbol, onSymbol }: { markets: MarketDeployment[]; symbol: string | null; onSymbol: (s: MarketDeployment["symbol"]) => void }) {
  const { mode } = useIntatto()
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid min-w-0 gap-1">
        <h1 className="text-2xl font-semibold">Risk console</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every price the keeper posted or had refused, every session, cap, corporate action and liquidation, read from{" "}
          {mode === "sandbox" ? "the sandbox fork" : "X Layer"} with its transaction. Nothing here comes from our servers.{" "}
          <Link href="/" className="underline underline-offset-4">
            Back to the market
          </Link>
        </p>
      </div>
      {markets.length > 1 && symbol ? (
        <div className="grid gap-1.5">
          <span id="risk-market-label" className="text-xs text-muted-foreground">
            Market
          </span>
          <Select value={symbol} onValueChange={(v) => onSymbol(v as MarketDeployment["symbol"])}>
            <SelectTrigger aria-labelledby="risk-market-label" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {markets.map((m) => (
                <SelectItem key={m.symbol} value={m.symbol}>
                  {m.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : symbol ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Market </span>
          <span className="font-medium">{symbol}</span>
        </p>
      ) : null}
    </div>
  )
}

function Inner() {
  const { deployment } = useIntatto()
  const { address } = useAccount()
  const [symbol, setSymbol] = useState<MarketDeployment["symbol"]>("NVDAx")
  const [view, setView] = useView()
  const markets = deployment?.markets ?? []
  const market = markets.find((m) => m.symbol === symbol) ?? markets[0] ?? null

  if (!deployment || !market) {
    return (
      <div className="grid gap-6">
        <Header markets={[]} symbol={null} onSymbol={setSymbol} />
        <NotDeployed />
      </div>
    )
  }
  return (
    <RiskDataProvider key={market.market} deployment={deployment} market={market} account={address}>
      <div className="grid grid-cols-1 gap-5" data-testid="risk-console" data-view={view}>
        <Header markets={markets} symbol={market.symbol} onSymbol={setSymbol} />
        <ScanStatus />
        <GuardAlerts />
        <WalletNote />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
          <ViewNav view={view} onChange={setView} />
          <div className="min-w-0">{RENDER[view]()}</div>
        </div>
      </div>
    </RiskDataProvider>
  )
}

export function RiskConsole() {
  return (
    <ChainReady fallback={<ConsoleSkeleton />}>
      <Inner />
    </ChainReady>
  )
}
