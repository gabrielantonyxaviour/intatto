"use client"

/**
 * Price posts: every PricePosted and PriceRejected from the relay, newest first, with each guard's result
 * (after a risk dashboard's oracle table: time, spot, TWAP, divergence), plus the layered price in words.
 */
import { useMemo, useState } from "react"
import type { Session } from "@intatto/config/session"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRisk } from "./risk-data"
import { Check } from "./badges"
import { DataTable, type Column } from "./data-table"
import { REJECT_TEXT, type PricePost, type SessionPost } from "./events"
import { EventSourceNote } from "./status-bar"
import { Empty, LoadError, Panel, RowsSkeleton, Section, TxRef } from "./states"
import { clock, day, diffBps, duration, pctBps, usd18, usdgUsd } from "./format"
import type { RiskParams } from "./use-risk-params"

type Row = PricePost & { band: bigint | null; session: Session | null; move: bigint | null; moveComputed: boolean }

const before = (a: { block: bigint; logIndex: number }, b: { block: bigint; logIndex: number }) =>
  a.block < b.block || (a.block === b.block && a.logIndex < b.logIndex)

/** The session the relay saw when the post landed: the last session post before it, UNKNOWN once too old. */
function sessionAt(p: PricePost, sessions: SessionPost[], liveness: bigint | undefined): Session | null {
  const s = sessions.find((x) => before(x, p))
  if (!s || p.time === null || liveness === undefined) return null
  return BigInt(p.time - s.postedAt) > liveness ? "UNKNOWN" : s.session
}

function enrich(prices: PricePost[], sessions: SessionPost[], params: RiskParams | undefined): Row[] {
  return prices.map((p, i) => {
    const session = sessionAt(p, sessions, params?.session.livenessLimit)
    const band = session === null ? null : session === "OPEN" ? (params?.relay.bandOpenBps ?? null) : (params?.relay.bandOtherBps ?? null)
    // A rejection carries no move; it follows from the last accepted post before it.
    const lastAccepted = prices.slice(i + 1).find((q) => q.accepted)
    const move = p.moveBps ?? (lastAccepted ? diffBps(p.wrapperPriceE18, lastAccepted.wrapperPriceE18) : null)
    return { ...p, session, band, move, moveComputed: p.moveBps === null && move !== null }
  })
}

/** Value above its check on wide tables, side by side on cards. */
const STACK = "inline-flex flex-wrap items-center justify-end gap-1.5 xl:grid xl:justify-items-end xl:gap-1"

function columns(params: RiskParams | undefined): Column<Row>[] {
  const maxMove = params?.relay.maxMoveBps
  const peg = params?.relay.pegBps
  return [
    {
      id: "result",
      header: "Result · mined (UTC)",
      cardTitle: true,
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 xl:grid xl:justify-items-start">
          {r.accepted ? (
            <Badge variant="success-light">Accepted</Badge>
          ) : (
            <Badge variant="destructive-light" title={r.reason ? REJECT_TEXT[r.reason] : undefined}>
              Rejected · {r.reason ?? "unknown"}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {day(r.time)} {clock(r.time)}
          </span>
        </span>
      ),
    },
    {
      id: "quote",
      header: "Quote",
      align: "right",
      cell: (r) => (
        <span className="grid">
          <span data-value="quote">{usd18(r.quoteE18)}</span>
          <span className="text-xs text-muted-foreground">fetched {clock(r.fetchedAt)}</span>
        </span>
      ),
    },
    { id: "wrapper", header: "Per share", align: "right", cell: (r) => usd18(r.wrapperPriceE18) },
    {
      id: "twap",
      header: "Pool TWAP",
      align: "right",
      cell: (r) => (r.twapE18 > 0n ? usd18(r.twapE18) : <span className="text-muted-foreground">not reached</span>),
    },
    {
      id: "band",
      header: "Band check",
      align: "right",
      cell: (r) =>
        r.twapE18 === 0n ? (
          <Check ok={null} />
        ) : (
          <span className={STACK}>
            <span className="text-xs" data-value="deviation">
              {pctBps(r.deviationBps)}
              {r.band !== null ? ` of ±${pctBps(r.band, 0)}` : ""}
            </span>
            <Check ok={r.band !== null ? r.deviationBps <= r.band : r.accepted || r.reason !== "OutOfBand"} />
          </span>
        ),
    },
    {
      id: "move",
      header: "Move check",
      align: "right",
      cell: (r) =>
        r.move === null ? (
          <span className="text-xs text-muted-foreground">first post</span>
        ) : (
          <span className={STACK}>
            <span className="text-xs">
              {pctBps(r.move)}
              {maxMove !== undefined ? ` of ${pctBps(maxMove, 0)}` : ""}
              {r.moveComputed ? "*" : ""}
            </span>
            {r.twapE18 === 0n || (!r.accepted && r.reason === "OutOfBand") ? (
              <Check ok={null} />
            ) : (
              <Check ok={maxMove !== undefined ? r.move <= maxMove : r.reason !== "MaxMove"} />
            )}
          </span>
        ),
    },
    {
      id: "usdg",
      header: "USDG/USD",
      align: "right",
      cell: (r) =>
        r.usdgAnswer !== null ? (
          <span className={STACK}>
            <span className="text-xs">{usdgUsd(r.usdgAnswer)}</span>
            <Check ok={peg !== undefined ? diffBps(r.usdgAnswer, 100_000_000n) <= peg : true} label="peg" />
          </span>
        ) : r.reason === "UsdgStale" || r.reason === "UsdgOffPeg" ? (
          <Check ok={false} label={r.reason === "UsdgStale" ? "stale" : "off peg"} />
        ) : (
          <span className="text-xs text-muted-foreground">{r.twapE18 > 0n ? "passed, not emitted" : "not reached"}</span>
        ),
    },
    { id: "tx", header: "Transaction", cell: (r) => <TxRef hash={r.tx} /> },
  ]
}

export function PricePostsView() {
  const { rows, logs, params, market } = useRisk()
  const [filter, setFilter] = useState<"all" | "accepted" | "rejected">("all")
  const all = useMemo(() => enrich(rows.prices, rows.sessions, params.data), [rows.prices, rows.sessions, params.data])
  const shown = all.filter((r) => filter === "all" || (filter === "accepted" ? r.accepted : !r.accepted))
  const rejected = all.filter((r) => !r.accepted).length
  const p = params.data?.relay

  return (
    <Section
      id="prices"
      title="Price posts"
      description={
        <>
          Each {market.symbol} quote the keeper sent to the relay, with the guard that stopped it when one did. A rejected post changes nothing onchain. <EventSourceNote />
        </>
      }
      actions={
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList aria-label="Filter price posts">
            <TabsTrigger value="all">All {all.length}</TabsTrigger>
            <TabsTrigger value="accepted">Accepted {all.length - rejected}</TabsTrigger>
            <TabsTrigger value="rejected">Rejected {rejected}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <Panel title="How the price is built" description="Layered and checked onchain on every post.">
        <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
          <li>The issuer&apos;s indicative {market.symbol} quote, fetched by Intatto&apos;s keeper. It has no source timestamp, so the relay records when the keeper fetched it{p?.maxFetchAge !== undefined ? ` and refuses fetches older than ${duration(p.maxFetchAge)}` : ""}.</li>
          <li>Converted to a wrapper-share price with the wrapper&apos;s own share-to-token rate (the issuer multiplier is inside it, never applied twice).</li>
          <li>
            Checked against the wrapper/USDG pool&apos;s {p?.twapWindow ? duration(p.twapWindow) : "30-minute"} TWAP: within ±{p?.bandOpenBps !== undefined ? pctBps(p.bandOpenBps, 0) : "3%"} while the market is OPEN, ±
            {p?.bandOtherBps !== undefined ? pctBps(p.bandOtherBps, 0) : "8%"} otherwise.
          </li>
          <li>Capped at {p?.maxMoveBps !== undefined ? pctBps(p.maxMoveBps, 0) : "15%"} of movement from the last accepted post, and refused while Chainlink USDG/USD is stale or more than {p?.pegBps !== undefined ? pctBps(p.pegBps, 0) : "1%"} off $1.</li>
        </ol>
      </Panel>
      {logs.status === "pending" ? <RowsSkeleton rows={5} label="Loading price posts" /> : null}
      {logs.status === "error" && !logs.range ? <LoadError what="price posts" error={logs.error} onRetry={logs.refresh} /> : null}
      {logs.range && shown.length === 0 ? (
        <Empty>{filter === "all" ? logs.backfilling ? "No price posts in the blocks read so far; older blocks are still loading." : "No price posts since the deployment." : `No ${filter} posts in the scanned blocks.`}</Empty>
      ) : null}
      {shown.length ? (
        <>
          <DataTable
            label="Price posts"
            breakpoint="xl"
            rows={shown}
            columns={columns(params.data)}
            rowKey={(r) => `${r.tx}:${r.logIndex}`}
            rowAttrs={(r) => ({
              "data-row": "price-post",
              "data-status": r.accepted ? "accepted" : "rejected",
              "data-reason": r.reason ?? undefined,
              "data-quote": r.quoteE18.toString(),
              "data-tx-hash": r.tx,
            })}
          />
          {all.some((r) => r.moveComputed) ? (
            <p className="text-xs text-muted-foreground">* A rejection does not emit its move; it is worked out from the last accepted post before it.</p>
          ) : null}
        </>
      ) : null}
    </Section>
  )
}
