"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { InfoIcon } from "lucide-react"
import type { MarketDeployment } from "@intatto/config/deployments"
import type { MarketState, VaultState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { SessionBadge } from "./session-badge"
import { refusalsFor } from "./copy"
import { bps, bpsShort, sharesToTokens, tokens, usdg } from "./format"

export type MarketRow = { deployment: MarketDeployment; state: MarketState }

const GRID = "lg:grid lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)] lg:items-center lg:gap-4"

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 lg:block", className)}>
      <span className="text-xs text-muted-foreground lg:hidden">{label}</span>
      <span className="text-right tabular-nums lg:text-left">{children}</span>
    </div>
  )
}

function StockRow({ row, selected, onSelect }: { row: MarketRow; selected: boolean; onSelect: () => void }) {
  const { deployment: d, state: s } = row
  const amount = sharesToTokens(s.totalShares, s.assetsPerShare)
  return (
    <li
      data-testid={`market-row-${d.symbol}`}
      aria-current={selected ? "true" : undefined}
      className={cn("grid gap-2 rounded-lg border p-3 text-sm lg:rounded-none lg:border-0 lg:border-t lg:px-3 lg:py-2.5", GRID, selected && "bg-muted/60")}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="font-medium underline-offset-4 hover:underline">{d.symbol}</span>
        <Badge variant="outline" size="sm">Collateral only</Badge>
        <SessionBadge session={s.session} />
        <span className="sr-only">Show the {d.symbol} market below</span>
      </button>
      <Cell label="Collateral supplied">
        {tokens(amount, d.symbol)}
        <span className="block text-xs text-muted-foreground">{usdg(s.totalCollateralValue)}</span>
      </Cell>
      <Cell label="Borrowed against it">{usdg(s.totalDebt)}</Cell>
      <Cell label="Max LTV now / liquidation">
        <span data-testid={`row-max-ltv-${d.symbol}`}>{bps(s.maxLtvBps)}</span>
        <span className="text-muted-foreground"> / {bpsShort(s.liquidationThresholdBps)}</span>
      </Cell>
      <Cell label="Supply / borrow rate">
        <span aria-label="No rate: collateral is not lent out or borrowed">– / –</span>
      </Cell>
      <div className="flex justify-end gap-2 pt-1 lg:pt-0">
        <Button asChild size="sm" variant="outline">
          <Link href="/borrow">Add collateral</Link>
        </Button>
      </div>
    </li>
  )
}

function UsdgRow({ vault, loans }: { vault: VaultState; loans: bigint }) {
  return (
    <li data-testid="market-row-USDG" className={cn("grid gap-2 rounded-lg border p-3 text-sm lg:rounded-none lg:border-0 lg:border-t lg:px-3 lg:py-2.5", GRID)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">USDG</span>
        <Badge variant="outline" size="sm">Lend or borrow</Badge>
      </div>
      <Cell label="Supplied by lenders">{usdg(vault.totalAssets)}</Cell>
      <Cell label="Borrowed">{usdg(loans)}</Cell>
      <Cell label="Max LTV now / liquidation">–</Cell>
      <Cell label="Supply / borrow rate">
        {bps(vault.supplyRateBps)} / {bps(vault.borrowRateBps)}
      </Cell>
      <div className="flex justify-end gap-2 pt-1 lg:pt-0">
        <Button asChild size="sm" variant="outline">
          <Link href="/lend">Lend</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/borrow">Borrow</Link>
        </Button>
      </div>
    </li>
  )
}

/** Every market as a row (cards on phones); markets where new borrowing is off sit behind a toggle. */
export function MarketsTable({
  rows,
  vault,
  selected,
  onSelect,
}: {
  rows: MarketRow[]
  vault: VaultState
  selected: string
  onSelect: (symbol: MarketDeployment["symbol"]) => void
}) {
  const open = rows.filter((r) => refusalsFor(r.state).length === 0)
  const off = rows.filter((r) => refusalsFor(r.state).length > 0)
  const [showOff, setShowOff] = useState(open.length === 0)
  const loans = rows.reduce((sum, r) => sum + r.state.totalDebt, 0n)
  const shown = open.length + (showOff || open.length === 0 ? off.length : 0)

  return (
    <section aria-labelledby="markets-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="markets-title" className="text-base font-medium">
          Markets
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span data-testid="markets-count">
            Showing {shown} of {rows.length} stock {rows.length === 1 ? "market" : "markets"}
          </span>
          {off.length > 0 && open.length > 0 ? (
            <div className="flex items-center gap-2">
              <Checkbox id="show-off" checked={showOff} onCheckedChange={(v) => setShowOff(v === true)} />
              <Label htmlFor="show-off" className="font-normal">
                Show markets where borrowing is off ({off.length})
              </Label>
            </div>
          ) : null}
        </div>
      </div>
      <div className="lg:rounded-xl lg:ring-1 lg:ring-foreground/10">
        <div className={cn("hidden px-3 py-2 text-xs text-muted-foreground", GRID)} aria-hidden>
          <span>Asset</span>
          <span>Supplied</span>
          <span>Borrowed</span>
          <span>Max LTV now / liq.</span>
          <span>Supply / borrow rate (yr)</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="grid gap-3 lg:gap-0">
          {open.map((r) => (
            <StockRow key={r.deployment.symbol} row={r} selected={selected === r.deployment.symbol} onSelect={() => onSelect(r.deployment.symbol)} />
          ))}
          <UsdgRow vault={vault} loans={loans} />
        </ul>
        {off.length > 0 && (showOff || open.length === 0) ? (
          <div data-testid="markets-off" className="grid gap-3 pt-3 lg:gap-0 lg:border-t lg:pt-0">
            <Alert variant="info" className="lg:m-3 lg:w-auto">
              <InfoIcon aria-hidden />
              <AlertDescription>
                New borrowing is off in {off.length === 1 ? "this market" : "these markets"} right now; repaying and adding
                collateral still work. Open a market to see which check refuses it.
              </AlertDescription>
            </Alert>
            <ul className="grid gap-3 lg:gap-0">
              {off.map((r) => (
                <StockRow key={r.deployment.symbol} row={r} selected={selected === r.deployment.symbol} onSelect={() => onSelect(r.deployment.symbol)} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
