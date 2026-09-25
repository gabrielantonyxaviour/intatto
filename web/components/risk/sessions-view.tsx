"use client"

/** Sessions: the state now, the new-borrow LTV each state allows, and the timeline of the keeper's session posts. */
import type { Session } from "@intatto/config/session"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRisk } from "./risk-data"
import { DefinitionPopover } from "@/components/ui/ix"
import { SessionBadge } from "./badges"
import { DataTable } from "./data-table"
import { EventSourceNote, useDirectPlace } from "./status-bar"
import { Empty, LoadError, Panel, RowsSkeleton, Section, TxRef } from "./states"
import { ago, clock, day, duration, pctBps, utc } from "./format"
import type { SessionPost } from "./events"

type Segment = { session: Session; from: number; to: number; posts: number }

/** Consecutive posts of the same session, oldest first. */
function segments(posts: SessionPost[]): Segment[] {
  const out: Segment[] = []
  for (const p of [...posts].reverse()) {
    const last = out[out.length - 1]
    if (last && last.session === p.session) {
      last.to = p.postedAt
      last.posts += 1
    } else out.push({ session: p.session, from: p.postedAt, to: p.postedAt, posts: 1 })
  }
  return out
}

export function SessionsView() {
  const { rows, marketState, params, logs, now } = useRisk()
  const s = marketState.data
  const p = params.data?.session
  const table: { session: Session; ltv: string; note: string }[] = [
    { session: "OPEN", ltv: p?.openBps !== undefined ? pctBps(p.openBps, 0) : "unknown", note: "US regular hours" },
    { session: "EXTENDED", ltv: p?.extendedBps !== undefined ? pctBps(p.extendedBps, 0) : "unknown", note: "Pre-market, after-hours and overnight" },
    {
      session: "CLOSED",
      ltv:
        p?.closedStartBps !== undefined && p.closedFloorBps !== undefined
          ? `${pctBps(p.closedStartBps, 0)} → ${pctBps(p.closedFloorBps, 0)}`
          : "unknown",
      note: `Weekends and holidays; falls in a straight line${p?.closedDecayDuration !== undefined ? ` over ${duration(p.closedDecayDuration)}` : ""} from the issuer's period change`,
    },
    { session: "HALTED", ltv: "0%", note: "The issuer halted trading" },
    { session: "CORPORATE_ACTION", ltv: "0%", note: "A split or dividend is activating" },
    {
      session: "UNKNOWN",
      ltv: "0%",
      note: `No session post${p?.livenessLimit !== undefined ? ` in the last ${duration(p.livenessLimit)}` : " recently"}`,
    },
  ]
  const timeline = segments(rows.sessions)
  const place = useDirectPlace()

  return (
    <Section id="sessions" title="Sessions" description={<>The keeper posts the stock market&apos;s session from the issuer&apos;s trading period; the session sets how far anyone can borrow. The liquidation LTV does not change with it. The session now is read directly from {place}.</>}>
      {marketState.isError && !s ? <LoadError what="the session" error={marketState.error} onRetry={() => marketState.refetch()} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Now">
          {s ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Session</dt>
                <dd>
                  <SessionBadge session={s.session} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Max new-borrow LTV</dt>
                <dd className="font-medium tabular-nums">{pctBps(s.maxLtvBps)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last post</dt>
                <dd className="text-right tabular-nums">{ago(s.sessionPostedAt, now)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Period began</dt>
                <dd className="text-right tabular-nums">{utc(s.periodChangedAt)}</dd>
              </div>
            </dl>
          ) : (
            <RowsSkeleton rows={3} />
          )}
        </Panel>
        <Panel
          title={
            <span className="inline-flex items-center gap-1">
              New-borrow LTV by session
              <DefinitionPopover term="Liquidation threshold" source="CollateralMarket">
                The session changes how much new debt is allowed. Liquidation uses one fixed threshold in every session. The number in this table is that read, not a typed default.
              </DefinitionPopover>
            </span>
          }
          description={`The session controller, read directly from ${place}. Liquidation stays at ${s ? pctBps(s.liquidationThresholdBps, 0) : "unknown"} in every row.`}
        >
          <Table aria-label="New-borrow LTV by session">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs text-muted-foreground">Session</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">Max LTV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.map((r) => (
                <TableRow key={r.session} data-session-row={r.session} className={cn(s?.session === r.session && "bg-muted")}>
                  <TableCell className="whitespace-normal">
                    <span className="grid gap-1">
                      <SessionBadge session={r.session} />
                      <span className="text-xs text-muted-foreground">{r.note}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right align-top font-medium tabular-nums">{r.ltv}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>

      <Panel title="Timeline" description={<>Each run of identical posts, oldest first. <EventSourceNote /></>}>
        {logs.status === "pending" ? <RowsSkeleton rows={2} /> : null}
        {logs.range && timeline.length === 0 ? <Empty>No session posts in the scanned blocks.</Empty> : null}
        {timeline.length ? (
          <ol className="grid gap-2 text-sm" aria-label="Session timeline">
            {timeline.map((t, i) => (
              <li key={`${t.from}:${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <SessionBadge session={t.session} />
                <span className="tabular-nums text-muted-foreground">
                  {utc(t.from)}
                  {t.to !== t.from ? ` → ${clock(t.to)}` : ""} · {t.posts} post{t.posts === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </Panel>

      {rows.sessions.length ? (
        <Panel title={`All session posts (${rows.sessions.length})`}>
          <DataTable<SessionPost>
            label="Session posts"
            rows={rows.sessions}
            rowKey={(r) => `${r.tx}:${r.logIndex}`}
            rowAttrs={(r) => ({ "data-row": "session-post", "data-session": r.session, "data-tx-hash": r.tx })}
            columns={[
              { id: "session", header: "Session", cardTitle: true, cell: (r) => <SessionBadge session={r.session} /> },
              { id: "posted", header: "Posted (UTC)", cell: (r) => `${day(r.postedAt)} ${clock(r.postedAt)}` },
              { id: "period", header: "Period began (UTC)", cell: (r) => `${day(r.periodChangedAt)} ${clock(r.periodChangedAt)}` },
              { id: "tx", header: "Transaction", cell: (r) => <TxRef hash={r.tx} /> },
            ]}
          />
        </Panel>
      ) : null}
    </Section>
  )
}
