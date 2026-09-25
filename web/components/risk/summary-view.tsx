"use client"

/** Summary: the market's headline numbers, then totals across its loans. */
import { Progress } from "@/components/ui/progress"
import { useRisk } from "./risk-data"
import { SessionBadge } from "./badges"
import { EventSourceNote, useDirectPlace } from "./status-bar"
import { LoadError, Panel, Section } from "./states"
import { Tile, TileGrid, TileSkeleton } from "./tiles"
import { ago, blockNo, clock, pctBps, usd18, usdg, utc } from "./format"

function ratioBps(part: bigint, whole: bigint): bigint | null {
  return whole === 0n ? null : (part * 10_000n) / whole
}

export function SummaryView() {
  const { market, marketState, vaultState, rows, now, loans, latestBlock } = useRisk()
  const place = useDirectPlace()
  const s = marketState.data
  const v = vaultState.data
  const accepted = rows.prices.filter((p) => p.accepted)
  const oldest = accepted[accepted.length - 1]
  const priceDelta = s && oldest && oldest.quoteE18 > 0n && accepted.length > 1 ? ((s.priceE18 - oldest.quoteE18) * 10_000n) / oldest.quoteE18 : null
  const capUse = s ? ratioBps(s.totalDebt, s.capUsdg) : null
  const openLoans = loans.data?.loans.filter((l) => l.debt > 0n).length

  return (
    <Section
      id="summary"
      title={`${market.symbol} summary`}
      description={
        <>
          Market lens and vault figures are read directly from {place}
          {latestBlock !== null ? <> at block {blockNo(latestBlock)}</> : null} (chain time {utc(now)}). The price is the issuer&apos;s
          indicative quote relayed by Intatto&apos;s keeper; it carries no source timestamp, so only the keeper&apos;s fetch time is shown.
        </>
      }
    >
      {marketState.isError && !s ? <LoadError what="the market state" error={marketState.error} onRetry={() => marketState.refetch()} /> : null}
      <TileGrid busy={!s}>
        {s ? (
          <>
            <Tile
              testId="session"
              label="Market session"
              value={<SessionBadge session={s.session} />}
              sub={<>Posted {ago(s.sessionPostedAt, now)} · period began {utc(s.periodChangedAt)}</>}
            />
            <Tile
              testId="max-ltv"
              label="Max new-borrow LTV now"
              value={pctBps(s.maxLtvBps)}
              sub={<>Liquidation at {pctBps(s.liquidationThresholdBps, 0)} in every session</>}
            />
            <Tile
              testId="price"
              label={`${market.symbol} relayed price`}
              value={usd18(s.priceE18)}
              delta={
                priceDelta === null ? null : priceDelta === 0n ? (
                  <span className="text-muted-foreground">Unchanged since the oldest post read ({clock(oldest!.time)} UTC)</span>
                ) : (
                  <span className={priceDelta < 0n ? "text-destructive" : "text-success-foreground"}>
                    {priceDelta > 0n ? "▲" : "▼"} {pctBps(priceDelta < 0n ? -priceDelta : priceDelta)} since the oldest post read ({clock(oldest!.time)} UTC)
                  </span>
                )
              }
              sub={
                <>
                  Fetched by the keeper {ago(s.fetchedAt, now)} at {clock(s.fetchedAt)} UTC · {s.fresh ? "fresh" : "stale"} ·{" "}
                  {usd18((s.priceE18 * s.assetsPerShare) / 10n ** 18n)} per wrapper share
                </>
              }
            />
            <Tile
              testId="cap"
              label="Credit cap used"
              value={capUse === null ? "–" : pctBps(capUse)}
              sub={
                <span className="grid gap-1.5">
                  <Progress value={capUse === null ? 0 : Math.min(100, Number(capUse) / 100)} aria-label="Credit cap used" />
                  {usdg(s.totalDebt)} of {usdg(s.capUsdg)}
                </span>
              }
            />
            <Tile
              testId="reserve"
              label="Gap reserve"
              value={v ? usdg(v.reserveBalance) : "–"}
              sub="Pays a liquidation shortfall before any lender loses money"
            />
            <Tile
              testId="deficit"
              label="Lender deficit"
              value={v ? usdg(v.totalDeficit) : "–"}
              sub={v ? `${v.deficitCount.toString()} recognised; 0 means no lender has lost money` : undefined}
            />
          </>
        ) : (
          <TileSkeleton count={6} />
        )}
      </TileGrid>

      <Panel title="Across the loans read" description={<>Borrowers are found from Borrow events in the scanned blocks. <EventSourceNote /></>}>
        {s && v ? (
          <div className="grid gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Open loans" value={openLoans === undefined ? "–" : openLoans.toLocaleString("en-US")} />
              <Stat label="Borrowed" value={usdg(s.totalDebt)} />
              <Stat label="Collateral value" value={usdg(s.totalCollateralValue)} />
              <Stat label="USDG supplied" value={usdg(v.totalAssets)} />
            </dl>
            <CoverageBar debt={s.totalDebt} collateral={s.totalCollateralValue} />
          </div>
        ) : (
          <TileSkeleton count={1} />
        )}
      </Panel>
    </Section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums break-words">{value}</dd>
    </div>
  )
}

/** Collateral against debt as two bars on one scale. */
function CoverageBar({ debt, collateral }: { debt: bigint; collateral: bigint }) {
  const max = collateral > debt ? collateral : debt
  const w = (x: bigint) => (max === 0n ? 0 : Number((x * 1000n) / max) / 10)
  return (
    <div className="grid gap-2 text-xs" aria-label="Collateral value against debt">
      {[
        { label: "Collateral", value: collateral, cls: "bg-primary" },
        { label: "Debt", value: debt, cls: "bg-foreground/40" },
      ].map((b) => (
        <div key={b.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
          <span className="text-muted-foreground">{b.label}</span>
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-3 min-w-0 flex-1">
              <div className={`h-full rounded-sm ${b.cls}`} style={{ width: `${w(b.value)}%` }} />
            </div>
            <span className="shrink-0 text-right tabular-nums sm:w-32">{usdg(b.value, 0)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
