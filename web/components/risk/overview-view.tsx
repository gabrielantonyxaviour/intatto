"use client"

/**
 * Market overview (after a risk dashboard's market page): when the data was read, current stats, and one table
 * of the market's rates and usage with the stressed cells tinted.
 */
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRisk } from "./risk-data"
import { LoadError, RowsSkeleton, Section } from "./states"
import { Tile, TileGrid, TileSkeleton } from "./tiles"
import { blockNo, pctBps, usd18, usdg, utc } from "./format"

/** Neutral below 80%, amber from 80%, red from 90%: the same stress steps for utilisation and cap usage. */
function stress(bps: bigint | null): string | undefined {
  if (bps === null) return undefined
  if (bps >= 9_000n) return "bg-destructive/10 text-destructive"
  if (bps >= 8_000n) return "bg-warning/10 text-warning-foreground"
  return undefined
}

export function OverviewView() {
  const { market, marketState, vaultState, loans, latestBlock, now, params } = useRisk()
  const s = marketState.data
  const v = vaultState.data
  const capUsed = s && s.capUsdg > 0n ? (s.totalDebt * 10_000n) / s.capUsdg : null
  const openLoans = loans.data?.loans.filter((l) => l.debt > 0n).length
  const failed = (marketState.isError && !s) || (vaultState.isError && !v)

  const rows: { k: string; v: string; tone?: string; id: string }[] =
    s && v
      ? [
          { id: "price", k: `${market.symbol} relayed price`, v: usd18(s.priceE18) },
          { id: "utilization", k: "Vault utilisation", v: pctBps(v.utilizationBps), tone: stress(v.utilizationBps) },
          { id: "borrow-apr", k: "Borrow rate (APR)", v: pctBps(v.borrowRateBps) },
          { id: "supply-apr", k: "Supply rate (APR)", v: pctBps(v.supplyRateBps) },
          { id: "cap-used", k: "Credit cap used", v: capUsed === null ? "–" : pctBps(capUsed), tone: stress(capUsed) },
          { id: "max-ltv", k: "Max new-borrow LTV now", v: pctBps(s.maxLtvBps) },
          { id: "liq-ltv", k: "Liquidation LTV", v: pctBps(s.liquidationThresholdBps) },
          { id: "reserve-factor", k: "Reserve factor", v: params.data?.market.reserveFactorBps !== undefined ? pctBps(params.data.market.reserveFactorBps, 0) : "–" },
        ]
      : []

  return (
    <Section
      id="overview"
      title={`Market overview: ${market.symbol}`}
      description={<>Data read at block {latestBlock !== null ? blockNo(latestBlock) : "–"}, chain time {utc(now)}. Refreshes every few seconds.</>}
    >
      {failed ? (
        <LoadError
          what="the market"
          error={(marketState.error ?? vaultState.error) as Error | null}
          onRetry={() => {
            void marketState.refetch()
            void vaultState.refetch()
          }}
        />
      ) : null}
      <TileGrid busy={!s || !v}>
        {s && v ? (
          <>
            <Tile testId="ov-loans" label="Open loans read" value={openLoans === undefined ? "–" : openLoans.toLocaleString("en-US")} />
            <Tile testId="ov-supplied" label="USDG supplied" value={usdg(v.totalAssets)} />
            <Tile testId="ov-borrowed" label="USDG borrowed" value={usdg(s.totalDebt)} />
            <Tile testId="ov-idle" label="USDG idle in the vault" value={usdg(v.idle)} />
            <Tile testId="ov-collateral" label="Collateral value" value={usdg(s.totalCollateralValue)} />
            <Tile testId="ov-price" label={`${market.symbol} price`} value={usd18(s.priceE18)} />
          </>
        ) : (
          <TileSkeleton count={6} />
        )}
      </TileGrid>
      {rows.length ? (
        <div className="rounded-xl border">
          <Table aria-label="Rates and usage">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs text-muted-foreground">Measure</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">{market.symbol}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-measure={r.id}>
                  <TableCell className="whitespace-normal">{r.k}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", r.tone)}>{r.v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : !failed ? (
        <RowsSkeleton rows={4} />
      ) : null}
      <p className="text-xs text-muted-foreground">Tinted cells are under stress: amber from 80%, red from 90%.</p>
    </Section>
  )
}
