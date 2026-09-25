"use client"

import Link from "next/link"
import type { MarketSymbol, MarketState } from "@/lib/chain"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExplorerLink } from "@/components/ui/web3/explorer-link"
import { priceLayers } from "./copy"
import type { RelayDetail } from "./use-market-params"
import { usePricePosts } from "./use-price-posts"
import { bps, formatUtc, usdPrice } from "./format"

function RecentPosts({ symbol, fetchedAt }: { symbol: MarketSymbol; fetchedAt: number }) {
  const posts = usePricePosts(symbol, fetchedAt)
  if (posts.isPending) return <Skeleton className="h-24" />
  if (posts.isError) {
    return <p className="text-sm text-destructive">Recent keeper posts could not be read from the RPC.</p>
  }
  if (posts.data.posts.length === 0) {
    return <p className="text-sm text-muted-foreground">No accepted keeper posts in the blocks scanned.</p>
  }
  return (
    <ol data-testid="price-posts" className="grid gap-2 text-sm">
      {posts.data.posts.map((p) => (
        <li key={p.txHash} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t pt-2 first:border-t-0 first:pt-0">
          <span className="tabular-nums">{formatUtc(p.fetchedAt)}</span>
          <span className="font-medium tabular-nums">{usdPrice(p.quoteE18)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {bps(p.deviationBps)} from TWAP · moved {bps(p.moveBps)}
          </span>
          <ExplorerLink hash={p.txHash} className="text-xs text-muted-foreground" />
        </li>
      ))}
    </ol>
  )
}

/** The price in layers, in words, with the keeper's recent accepted posts under it. */
export function PricePanel({ symbol, state: s, relay }: { symbol: MarketSymbol; state: MarketState; relay: RelayDetail | undefined }) {
  const noPrice = s.priceE18 === 0n
  return (
    <Card data-testid="price-panel">
      <CardHeader>
        <CardTitle>How the {symbol} price is made</CardTitle>
        <CardDescription>
          {noPrice ? (
            <span data-testid="price-value">No price posted yet</span>
          ) : (
            <>
              <span data-testid="price-value" className="font-medium text-foreground tabular-nums">
                {usdPrice(s.priceE18)}
              </span>{" "}
              per {symbol}, fetched by the keeper at <span data-testid="price-fetched-at">{formatUtc(s.fetchedAt)}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {relay && !noPrice ? (
          <ol data-testid="price-layers" className="grid list-decimal gap-2 pl-5 text-sm leading-relaxed">
            {priceLayers(s, relay, symbol).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : !noPrice ? (
          <Skeleton className="h-20" />
        ) : null}
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Recent keeper posts</h3>
          <p className="text-xs text-muted-foreground">Newest first. Each post passed the relay&apos;s checks when it landed.</p>
          <RecentPosts symbol={symbol} fetchedAt={s.fetchedAt} />
          <p className="text-sm text-muted-foreground">
            The relayed price next to the pool TWAP over time is on{" "}
            <Link href="/risk" data-testid="price-risk-link" className="font-medium text-foreground underline underline-offset-4">
              the Risk page
            </Link>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
