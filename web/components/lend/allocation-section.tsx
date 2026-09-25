"use client"

import type { MarketState, VaultState } from "@/lib/chain"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTokenAmount, formatUtc } from "@/components/ui/web3"
import { bpsText, ratioText, usdg } from "./lend-format"
import { Section } from "./overview-section"
import { SummaryRow } from "./summary-row"

const SESSION_NAMES: Record<MarketState["session"], string> = {
  OPEN: "US market open",
  EXTENDED: "extended hours",
  CLOSED: "market closed",
  HALTED: "trading halted",
  CORPORATE_ACTION: "corporate action",
  UNKNOWN: "session unknown",
}

function capUsed(m: MarketState) {
  return m.capUsdg === 0n ? 0 : Math.min(100, (Number(m.totalDebt) / Number(m.capUsdg)) * 100)
}

/** Where the money is lent: the one NVDAx market with its collateral, threshold, debt and cap. */
export function AllocationSection({ vault, market }: { vault: VaultState; market: MarketState }) {
  const headroom = market.capUsdg > market.totalDebt ? market.capUsdg - market.totalDebt : 0n
  const available = headroom < vault.idle ? headroom : vault.idle
  const lent = vault.totalAssets > vault.idle ? vault.totalAssets - vault.idle : 0n
  const limitNow = `${bpsText(market.maxLtvBps, 0)} · ${SESSION_NAMES[market.session]}`
  const rows = [
    { label: "Borrowed", value: usdg(market.totalDebt) },
    { label: "Collateral value", value: usdg(market.totalCollateralValue) },
    { label: "Threshold", value: bpsText(market.liquidationThresholdBps, 0) },
    { label: "Debt cap", value: usdg(market.capUsdg, 0), sub: `${capUsed(market).toFixed(1)}% used` },
    { label: "Can still be borrowed", value: usdg(available, 0) },
  ]

  return (
    <Section id="allocation" title="Where the money is lent">
      <p className="text-sm text-muted-foreground">
        The vault lends to one market. Every USDG that is not idle is owed by people borrowing against NVDAx.
      </p>
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

      <div className="hidden xl:block" data-testid="allocation-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              {rows.map((r) => (
                <TableHead key={r.label} className="text-right whitespace-normal">
                  {r.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <span className="flex items-center gap-2 font-medium">
                  USDG <span className="text-muted-foreground">|</span> NVDAx
                  <Badge variant="outline">{bpsText(market.liquidationThresholdBps, 0)} LT</Badge>
                </span>
              </TableCell>
              {rows.map((r) => (
                <TableCell key={r.label} className="text-right tabular-nums">
                  {r.value}
                  {r.sub ? <span className="block text-xs text-muted-foreground">{r.sub}</span> : null}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border p-3 xl:hidden" data-testid="allocation-card">
        <p className="mb-3 flex items-center gap-2 font-medium">
          USDG <span className="text-muted-foreground">|</span> NVDAx
          <Badge variant="outline">{bpsText(market.liquidationThresholdBps, 0)} LT</Badge>
        </p>
        <dl className="grid gap-2">
          {rows.map((r) => (
            <SummaryRow key={r.label} label={r.label}>
              {r.value}
              {r.sub ? ` · ${r.sub}` : null}
            </SummaryRow>
          ))}
        </dl>
      </div>

      <p className="text-sm">
        New-borrow limit now: <span className="font-medium tabular-nums">{limitNow}</span>. It follows the US market
        session; the 65% liquidation threshold does not.
      </p>

      <p className="text-sm text-muted-foreground">
        Collateral is NVDAx held as the issuer&apos;s wNVDAx wrapper shares. Its price is the issuer&apos;s indicative
        quote, ${formatTokenAmount(market.priceE18, 18, { maxFractionDigits: 2, minFractionDigits: 2 })} per NVDAx,
        fetched by the keeper at {market.fetchedAt ? formatUtc(market.fetchedAt) : "–"}.{" "}
        {market.fresh && market.inBand && market.pegOk
          ? "The relay's guards pass: the post is recent, inside the band around the pool's 30-minute average, and USDG is on peg."
          : `Guard failing: ${[
              !market.fresh && "the keeper's last post is older than 30 minutes",
              !market.inBand && "the price is outside the band around the pool's 30-minute average",
              !market.pegOk && "USDG is stale or off peg",
            ]
              .filter(Boolean)
              .join("; ")}. New borrowing is refused until it clears.`}
      </p>
    </Section>
  )
}
