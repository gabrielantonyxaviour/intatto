"use client"

import { useEffect, useState } from "react"
import { liveDeployment, useIntatto, usePriceProvenance, useProtocolParams, type MarketState, type VaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DefinitionPopover } from "@/components/ui/ix"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTokenAmount, formatUtc } from "@/components/ui/web3"
import { bpsText, marketList, ratioText, usdg } from "./lend-format"
import { Section } from "./overview-section"
import { SummaryRow } from "./summary-row"
import type { LendMarket } from "./use-lend-reads"

const SESSION_NAMES: Record<MarketState["session"], string> = {
  OPEN: "US market open",
  EXTENDED: "extended hours",
  CLOSED: "market closed",
  HALTED: "trading halted",
  CORPORATE_ACTION: "corporate action",
  UNKNOWN: "session unknown",
}

/** SPYx is not on X Layer mainnet. A configured live deployment is the source of truth when present. */
function sandboxOnly(symbol: string, mode: string): boolean {
  if (mode !== "sandbox") return false
  if (liveDeployment) return !liveDeployment.markets.some((m) => m.symbol === symbol)
  return symbol !== "NVDAx"
}

function capUsed(m: MarketState) {
  return m.capUsdg === 0n ? 0 : Math.min(100, (Number(m.totalDebt) / Number(m.capUsdg)) * 100)
}

function guardSentence(m: MarketState, fetchMin?: number, twapMin?: number): string {
  const age = fetchMin !== undefined ? `older than ${fetchMin} minutes` : "stale"
  const band = twapMin !== undefined ? `the pool's ${twapMin}-minute average` : "the pool's average"
  if (m.fresh && m.inBand && m.pegOk) {
    return `The relay's guards pass: the post is recent, inside the band around ${band}, and USDG is on peg.`
  }
  const failing = [
    !m.fresh && `the keeper's last post is ${age}`,
    !m.inBand && `the price is outside the band around ${band}`,
    !m.pegOk && "USDG is stale or off peg",
  ].filter(Boolean)
  return `Guard failing: ${failing.join("; ")}. New borrowing is refused until it clears.`
}

type Cell = { key: string; label: string; value: string; sub?: string }

function cellsFor(m: LendMarket, vault: VaultState): Cell[] {
  const headroom = m.state.capUsdg > m.state.totalDebt ? m.state.capUsdg - m.state.totalDebt : 0n
  const available = headroom < vault.idle ? headroom : vault.idle
  return [
    { key: "debt", label: "Borrowed", value: usdg(m.state.totalDebt) },
    { key: "collateral", label: "Collateral value", value: usdg(m.state.totalCollateralValue) },
    { key: "threshold", label: "Threshold", value: bpsText(m.state.liquidationThresholdBps, 0) },
    { key: "cap", label: "Debt cap", value: usdg(m.state.capUsdg, 0), sub: `${capUsed(m.state).toFixed(1)}% used` },
    { key: "available", label: "Can still be borrowed", value: usdg(available, 0) },
  ]
}

function MarketName({ symbol, threshold, only }: { symbol: string; threshold: string; only: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2 font-medium">
      USDG <span className="text-muted-foreground">|</span> {symbol}
      <Badge variant="outline">{threshold} LT</Badge>
      {only ? <Badge variant="outline">Sandbox only</Badge> : null}
    </span>
  )
}

function Value({ symbol, cell }: { symbol: string; cell: Cell }) {
  return <span data-testid={`allocation-${symbol}-${cell.key}`}>{cell.value}</span>
}

/** Where the money is lent: every market in the deployment, with its own debt, collateral, threshold and cap. */
export function AllocationSection({ vault, markets }: { vault: VaultState; markets: LendMarket[] }) {
  const { mode } = useIntatto()
  const provenance = usePriceProvenance()
  const params = useProtocolParams("NVDAx")
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#allocation") setOpen(true)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])
  const lent = vault.totalAssets > vault.idle ? vault.totalAssets - vault.idle : 0n
  const several = markets.length > 1
  const names = marketList(markets.map((m) => m.symbol))
  const rows = markets.map((m) => ({
    ...m,
    only: sandboxOnly(m.symbol, mode),
    threshold: bpsText(m.state.liquidationThresholdBps, 0),
    limitNow: `${bpsText(m.state.maxLtvBps, 0)} · ${SESSION_NAMES[m.state.session]}`,
    cells: cellsFor(m, vault),
    price: formatTokenAmount(m.state.priceE18, 18, { maxFractionDigits: 2, minFractionDigits: 2 }),
  }))
  const headers = rows[0]?.cells ?? []
  const fetchMin = params.data ? Number(params.data.relay.maxFetchAge) / 60 : undefined
  const twapMin = params.data ? Number(params.data.relay.twapWindow) / 60 : undefined
  const failing = rows.filter((m) => !(m.state.fresh && m.state.inBand && m.state.pegOk))

  return (
    <Section id="allocation" title="Where the money is lent">
      <p className="text-sm" data-testid="lend-exposure">
        Exposure: {names}
      </p>
      <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" data-testid="lend-price-source">
        {provenance.short}
        <DefinitionPopover term="price source" side="bottom" contentTestId="lend-price-detail" source={params.data ? `Block ${params.data.blockNumber}` : "Parameter snapshot unavailable"}>
          {provenance.detail}
          {rows.some((m) => m.symbol === "SPYx") ? " SPYx is a separate market; that sentence names the wNVDAx/USDG pool." : ""}
        </DefinitionPopover>
      </p>
      {failing.map((m) => (
        <Alert key={m.symbol} variant="warning">
          <AlertTitle>{m.symbol} guard</AlertTitle>
          <AlertDescription>{guardSentence(m.state, fetchMin, twapMin)}</AlertDescription>
        </Alert>
      ))}
      <div className="grid gap-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span>
            Lent out <span className="tabular-nums">{usdg(lent, 0)}</span>
          </span>
          <span className="text-muted-foreground">
            Idle <span className="tabular-nums">{usdg(vault.idle, 0)}</span> ({ratioText(vault.idle, vault.totalAssets, 1)})
          </span>
        </div>
        <Progress value={Number(vault.utilizationBps) / 100} aria-label="Share of deposits lent out" />
      </div>
      <Button type="button" variant="outline" aria-expanded={open} data-testid="allocation-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide allocation" : "Allocation"}
      </Button>
      {open ? (
        <div className="grid gap-4">
      <div className="hidden xl:block" data-testid="allocation-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              {headers.map((r) => (
                <TableHead key={r.label} className="text-right whitespace-normal">
                  {r.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.symbol} data-testid={`allocation-${m.symbol}`}>
                <TableCell>
                  <MarketName symbol={m.symbol} threshold={m.threshold} only={m.only} />
                </TableCell>
                {m.cells.map((r) => (
                  <TableCell key={r.label} className="text-right tabular-nums">
                    <Value symbol={m.symbol} cell={r} />
                    {r.sub ? <span className="block text-xs text-muted-foreground">{r.sub}</span> : null}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 xl:hidden" data-testid="allocation-card">
        {rows.map((m) => (
          <div key={m.symbol} className="rounded-lg border p-3" data-testid={`allocation-${m.symbol}`}>
            <div className="mb-3">
              <MarketName symbol={m.symbol} threshold={m.threshold} only={m.only} />
            </div>
            <dl className="grid gap-2">
              {m.cells.map((r) => (
                <SummaryRow key={r.label} label={r.label}>
                  <Value symbol={m.symbol} cell={r} />
                  {r.sub ? ` · ${r.sub}` : null}
                </SummaryRow>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {rows.map((m) => (
        <p key={`${m.symbol}-limit`} className="text-sm">
          {several ? `${m.symbol} new-borrow limit now` : "New-borrow limit now"}:{" "}
          <span className="font-medium tabular-nums">{m.limitNow}</span>. It follows the US market session; the{" "}
          {m.threshold} liquidation threshold does not.
        </p>
      ))}

      {rows.map((m) => (
        <p key={`${m.symbol}-note`} className="text-sm text-muted-foreground">
          {mode === "sandbox"
            ? `${m.symbol} price $${m.price}, simulated on this fork at ${m.state.fetchedAt ? formatUtc(m.state.fetchedAt) : "–"}. ${provenance.detail}${
                m.symbol === "NVDAx" ? "" : ` ${m.symbol} is its own market; that sentence names the wNVDAx/USDG pool.`
              } `
            : `Collateral is ${m.symbol} held as w${m.symbol}. Price $${m.price}, fetched by the keeper at ${
                m.state.fetchedAt ? formatUtc(m.state.fetchedAt) : "–"
              }. ${provenance.detail} `}
          {guardSentence(m.state, fetchMin, twapMin)}
          {m.only ? ` ${m.symbol} is sandbox-only: it is not on X Layer mainnet.` : ""}
        </p>
      ))}
        </div>
      ) : null}
    </Section>
  )
}
