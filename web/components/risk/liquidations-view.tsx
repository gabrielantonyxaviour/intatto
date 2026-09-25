"use client"

/**
 * Liquidations: every bounded slice (executed or waiting at its floor) joined with the market's settlement
 * (proceeds, repaid, penalty, reserve cover, deficit), plus the reserve and lender deficit now.
 */
import { Badge } from "@/components/ui/badge"
import { AddressDisplay } from "@/components/ui/web3"
import { useRisk } from "./risk-data"
import { SessionBadge } from "./badges"
import { DataTable, type Column } from "./data-table"
import { Empty, LoadError, Panel, RowsSkeleton, Section, TxRef } from "./states"
import { clock, day, perShare, pctBps, tokens18, usdg } from "./format"
import type { Slice } from "./events"

const orDash = (v: bigint | null | undefined, f: (x: bigint) => string) => (v === null || v === undefined ? "–" : f(v))

export function LiquidationsView() {
  const { rows, logs, vaultState, params, market } = useRisk()
  const v = vaultState.data
  const lp = params.data?.liquidator
  const executed = rows.slices.filter((s) => s.executed)
  const totals = executed.reduce(
    (a, s) => ({
      proceeds: a.proceeds + (s.settlement?.proceeds ?? 0n),
      repaid: a.repaid + (s.settlement?.repaid ?? 0n),
      covered: a.covered + (s.settlement?.reserveCovered ?? 0n),
      deficit: a.deficit + (s.settlement?.deficit ?? 0n),
    }),
    { proceeds: 0n, repaid: 0n, covered: 0n, deficit: 0n },
  )

  const columns: Column<Slice>[] = [
    {
      id: "result",
      header: "Slice",
      cardTitle: true,
      cell: (s) => (
        <span className="flex flex-wrap items-center gap-2">
          {s.executed ? <Badge variant="success-light">Executed</Badge> : <Badge variant="warning-light">Waiting at floor</Badge>}
          <SessionBadge session={s.session} />
          <span className="text-xs text-muted-foreground">
            {day(s.time)} {clock(s.time)}
          </span>
        </span>
      ),
    },
    { id: "borrower", header: "Borrower", cell: (s) => <AddressDisplay address={s.borrower} explorer copy={false} /> },
    {
      id: "sale",
      header: "Sold · oracle · floor",
      align: "right",
      cell: (s) => (
        <span className="grid">
          <span>{orDash(s.sharesSold, (x) => tokens18(x, `w${market.symbol}`))}</span>
          <span className="text-xs text-muted-foreground">
            {orDash(s.oraclePrice, perShare)} · floor {perShare(s.floorPrice)}
          </span>
        </span>
      ),
    },
    { id: "proceeds", header: "Proceeds", align: "right", cell: (s) => orDash(s.proceeds, (x) => usdg(x)) },
    {
      id: "settlement",
      header: "Repaid · penalty",
      align: "right",
      cell: (s) => (
        <span className="grid">
          <span>{orDash(s.settlement?.repaid, (x) => usdg(x))}</span>
          <span className="text-xs text-muted-foreground">penalty {orDash(s.settlement?.penalty, (x) => usdg(x))}</span>
        </span>
      ),
    },
    {
      id: "shortfall",
      header: "Reserve · deficit",
      align: "right",
      cell: (s) => (
        <span className="grid">
          <span>{orDash(s.settlement?.reserveCovered, (x) => usdg(x))}</span>
          <span className="text-xs text-muted-foreground">deficit {orDash(s.settlement?.deficit, (x) => usdg(x))}</span>
        </span>
      ),
    },
    { id: "tx", header: "Transaction", cell: (s) => <TxRef hash={s.tx} /> },
  ]

  return (
    <Section
      id="liquidations"
      title="Liquidations"
      description={`Past ${pctBps(params.data?.market.liquidationThresholdBps ?? 6_500n, 0)} LTV a position is sold into the pool in slices, never below a floor under the relayed price${lp?.openFloorBps !== undefined && lp.closedFloorBps !== undefined ? ` (${pctBps(lp.openFloorBps, 0)} below while trading, ${pctBps(lp.closedFloorBps, 0)} while CLOSED)` : ""}. A slice that cannot fill at its floor waits.`}
    >
      {vaultState.isError && !v ? <LoadError what="the reserve" error={vaultState.error} onRetry={() => vaultState.refetch()} /> : null}
      <Panel>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Gap reserve now", v ? usdg(v.reserveBalance) : "–"],
              ["Lender deficit now", v ? `${usdg(v.totalDeficit)} (${v.deficitCount.toString()})` : "–"],
              ["Repaid by slices read", usdg(totals.repaid)],
              ["Reserve covered · deficit", `${usdg(totals.covered)} · ${usdg(totals.deficit)}`],
            ] as const
          ).map(([k, val]) => (
            <div key={k} className="grid min-w-0 gap-0.5">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums break-words">{val}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      {logs.status === "pending" ? <RowsSkeleton rows={3} label="Loading liquidations" /> : null}
      {logs.status === "error" && !logs.range ? <LoadError what="liquidations" error={logs.error} onRetry={logs.refresh} /> : null}
      {logs.range && rows.slices.length === 0 ? <Empty>No liquidation has run in the scanned blocks.</Empty> : null}
      {rows.slices.length ? (
        <DataTable
          label="Liquidation slices"
          breakpoint="xl"
          rows={rows.slices}
          columns={columns}
          rowKey={(s) => `${s.tx}:${s.logIndex}`}
          rowAttrs={(s) => ({ "data-row": "slice", "data-executed": s.executed ? "true" : "false", "data-tx-hash": s.tx })}
        />
      ) : null}
    </Section>
  )
}
