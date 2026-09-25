"use client"

import Link from "next/link"
import { useAccount, useSwitchChain } from "wagmi"
import { Loader2Icon, TriangleAlertIcon, WalletIcon } from "lucide-react"
import type { MarketSymbol, MarketState } from "@/lib/chain"
import { useAccountState, useIntatto } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { RiskMeter } from "@/components/ui/web3/risk-meter"
import { LoadError } from "./states"
import { usdPrice, tokens, usdg } from "./format"

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span data-testid={testId} className="text-right font-medium tabular-nums">
        {value}
      </span>
    </div>
  )
}

function Actions() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button asChild variant="outline">
        <Link href="/lend">Lend USDG</Link>
      </Button>
      <Button asChild>
        <Link href="/borrow">Borrow USDG</Link>
      </Button>
    </div>
  )
}

function Body({ symbol, market }: { symbol: MarketSymbol; market: MarketState }) {
  const { chain, mode } = useIntatto()
  const { address, chainId, status } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const account = useAccountState(chainId === chain.id ? address : undefined, symbol)

  if (status === "connecting" || status === "reconnecting") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon aria-hidden className="size-4 animate-spin" />
        {mode === "sandbox" ? "Connecting the sandbox burner…" : "Connecting your wallet…"}
      </p>
    )
  }
  if (!address) {
    return (
      <div data-testid="your-info-disconnected" className="grid gap-3 text-sm">
        <p className="flex items-start gap-2">
          <WalletIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          Connect a wallet with the button at the top to see your {symbol} and USDG balances and your position.
        </p>
        <Actions />
      </div>
    )
  }
  if (chainId !== chain.id) {
    return (
      <div data-testid="your-info-wrong-network" className="grid gap-3 text-sm">
        <p className="flex items-start gap-2">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          Your wallet is on chain {chainId}. Switch to {chain.name} to see your balances and position here.
        </p>
        <Button variant="destructive" disabled={switching} onClick={() => switchChain({ chainId: chain.id })}>
          {switching ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
          Switch to {chain.name}
        </Button>
      </div>
    )
  }
  if (account.isPending) return <Skeleton className="h-48" />
  if (account.isError) return <LoadError what="your position" error={account.error} onRetry={() => void account.refetch()} />

  const a = account.data
  const ltv = a.debt === 0n ? null : Number(a.ltvBps) / 10_000
  const maxLtv = Number(market.maxLtvBps) / 10_000
  const lt = Number(market.liquidationThresholdBps) / 10_000
  return (
    <div data-testid="your-info-connected" className="grid gap-4">
      <div className="grid gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Wallet</h3>
        <Row label={symbol} value={tokens(a.walletToken, symbol)} testId="wallet-token" />
        <Row label="USDG" value={usdg(a.walletUsdg)} testId="wallet-usdg" />
      </div>
      <Separator />
      <div className="grid gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Your {symbol} loan</h3>
        {a.shares === 0n && a.debt === 0n ? (
          <p className="text-sm text-muted-foreground">No collateral or loan in this market yet.</p>
        ) : (
          <>
            <Row label="Collateral" value={`${tokens(a.assets, symbol)} · ${usdg(a.valueUsdg)}`} />
            <Row label="Debt" value={usdg(a.debt)} />
            {a.debt > 0n ? <Row label="Liquidation price" value={usdPrice(a.liquidationPriceE18)} /> : null}
            <RiskMeter ltv={ltv} maxLtv={maxLtv} liquidationThreshold={lt} levels={{ medium: maxLtv || 0.2, high: lt * 0.9 }} />
          </>
        )}
        <Row label="Can borrow now" value={usdg(a.borrowCapacity)} testId="borrow-capacity" />
      </div>
      <Separator />
      <div className="grid gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Lending</h3>
        <Row label="In the USDG vault" value={usdg(a.vaultAssets)} />
      </div>
      <Actions />
    </div>
  )
}

/** The connected wallet's side of this market: balances, loan, lending, and the way to Borrow and Lend. */
export function YourInfo({ symbol, market }: { symbol: MarketSymbol; market: MarketState }) {
  return (
    <Card data-testid="your-info">
      <CardHeader>
        <CardTitle>Your info</CardTitle>
        <CardDescription>Your balances and position in the {symbol} market.</CardDescription>
      </CardHeader>
      <CardContent>
        <Body symbol={symbol} market={market} />
      </CardContent>
    </Card>
  )
}
