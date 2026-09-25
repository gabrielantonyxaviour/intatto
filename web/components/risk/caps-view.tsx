"use client"

/**
 * Caps and LTV spread: the credit cap sized from pool exit depth with its live usage (after a reserve's daily
 * limits: limit, used, how it moves), every cap the keeper posted, and the debt spread by LTV.
 */
import type { ReactNode } from "react"
import { Progress } from "@/components/ui/progress"
import { useRisk } from "./risk-data"
import { DataTable } from "./data-table"
import { Empty, LoadError, Panel, RowsSkeleton, Section, TxRef } from "./states"
import { clock, day, pctBps, usdg } from "./format"
import { LtvHistogram } from "./ltv-histogram"
import type { CapPost } from "./events"

export function CapsView() {
  const { rows, marketState, params, loans, logs, market } = useRisk()
  const s = marketState.data
  const latest = rows.caps[0]
  const used = s && s.capUsdg > 0n ? (s.totalDebt * 10_000n) / s.capUsdg : null
  const step = params.data?.caps

  return (
    <Section
      id="caps"
      title="Caps and LTV spread"
      description={`Total ${market.symbol} debt is capped by how much collateral the pool could absorb in a sale. The keeper samples pool depth and posts a target; the contract lets the cap rise only gradually.`}
    >
      {marketState.isError && !s ? <LoadError what="the cap" error={marketState.error} onRetry={() => marketState.refetch()} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Credit cap" description="Read from the depth cap registry now.">
          {s ? (
            <dl className="grid gap-2 text-sm" data-testid="cap-usage">
              <Row k="Debt cap" v={<span data-value="cap">{usdg(s.capUsdg)}</span>} />
              <Row k="Borrowed against it" v={<span data-value="debt">{usdg(s.totalDebt)}</span>} />
              <Row k="Used" v={used === null ? "–" : pctBps(used)} />
              <Progress value={used === null ? 0 : Math.min(100, Number(used) / 100)} aria-label="Cap used" />
              <Row k="Room left" v={usdg(s.capUsdg > s.totalDebt ? s.capUsdg - s.totalDebt : 0n)} />
              <Row k="Liquidation slice while CLOSED" v={usdg(s.sliceUsdg)} />
            </dl>
          ) : (
            <RowsSkeleton rows={3} />
          )}
        </Panel>
        <Panel title="How the cap moves">
          <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
            <li>A lower target applies at once.</li>
            <li>
              A higher target is reached in whole hours: each hour adds{" "}
              {step?.stepBps !== undefined && step.minStepUsdg !== undefined
                ? `${pctBps(step.stepBps, 0)} of the last effective cap or ${usdg(step.minStepUsdg, 0)}, whichever is larger`
                : "a fixed step"}
              .
            </li>
            {latest && s ? (
              <li>
                Latest target {usdg(latest.targetUsdg)}
                {latest.targetUsdg > s.capUsdg ? `; the cap is ${usdg(latest.targetUsdg - s.capUsdg)} below it and still rising` : "; the cap has reached it"}.
              </li>
            ) : null}
            <li>A borrow that would take total debt above the cap is refused (TickerCapReached).</li>
          </ul>
        </Panel>
      </div>

      <Panel title="Caps the keeper posted" description="CapPosted events: target from sampled depth, slice size, and the cap in force right after the post.">
        {logs.status === "pending" ? <RowsSkeleton rows={3} /> : null}
        {logs.range && rows.caps.length === 0 ? <Empty>No cap posts in the scanned blocks.</Empty> : null}
        {rows.caps.length ? (
          <DataTable<CapPost>
            label="Cap posts"
            rows={rows.caps}
            rowKey={(r) => `${r.tx}:${r.logIndex}`}
            rowAttrs={(r) => ({ "data-row": "cap-post", "data-target": r.targetUsdg.toString(), "data-tx-hash": r.tx })}
            columns={[
              { id: "time", header: "Mined (UTC)", cardTitle: true, cell: (r) => `${day(r.time)} ${clock(r.time)}` },
              { id: "target", header: "Target", align: "right", cell: (r) => usdg(r.targetUsdg) },
              { id: "slice", header: "Slice", align: "right", cell: (r) => usdg(r.sliceUsdg) },
              { id: "effective", header: "Cap after post", align: "right", cell: (r) => usdg(r.effectiveUsdg) },
              { id: "tx", header: "Transaction", cell: (r) => <TxRef hash={r.tx} /> },
            ]}
          />
        ) : null}
      </Panel>

      <Panel title="Current LTV spread" description="Debt of the loans read, by their LTV now.">
        {loans.isPending ? <RowsSkeleton rows={2} /> : null}
        {loans.isError ? <LoadError what="the loans" error={loans.error} onRetry={() => loans.refetch()} /> : null}
        {loans.data && s ? (
          loans.data.loans.some((l) => l.debt > 0n) ? (
            <LtvHistogram loans={loans.data.loans} maxLtvBps={s.maxLtvBps} thresholdBps={s.liquidationThresholdBps} />
          ) : (
            <Empty>No open loans in the scanned blocks.</Empty>
          )
        ) : null}
      </Panel>
    </Section>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium tabular-nums">{v}</dd>
    </div>
  )
}
