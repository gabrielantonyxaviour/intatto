"use client"

import type { Deployment, MarketDeployment } from "@intatto/config/deployments"
import type { MarketState } from "@/lib/chain"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AddressDisplay } from "@/components/ui/web3/address-display"
import { sharesToTokens, tokens, usdg } from "./format"

/** Where the collateral sits and which contracts hold it: amounts plus every address, linked to the explorer. */
export function ContractsCard({ deployment, market: m, state: s }: { deployment: Deployment; market: MarketDeployment; state: MarketState }) {
  const rows: { label: string; address: string }[] = [
    { label: "Market (holds the collateral)", address: m.market },
    { label: "Price relay", address: m.priceRelay },
    { label: `${m.symbol} token`, address: m.token },
    { label: `w${m.symbol} wrapper`, address: m.wrapper },
    { label: `w${m.symbol}/USDG pool`, address: m.pool },
    { label: "USDG vault", address: deployment.vault },
  ]
  return (
    <Card data-testid="contracts-card">
      <CardHeader>
        <CardTitle>Collateral held onchain</CardTitle>
        <CardDescription>
          {tokens(sharesToTokens(s.totalShares, s.assetsPerShare), m.symbol)} held as{" "}
          {tokens(s.totalShares, `w${m.symbol}`)} shares, worth {usdg(s.totalCollateralValue)} at the relayed price.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <dt className="min-w-0 truncate text-muted-foreground">{r.label}</dt>
              <dd className="shrink-0">
                <AddressDisplay address={r.address} explorer />
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
