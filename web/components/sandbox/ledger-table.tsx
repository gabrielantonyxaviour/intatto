"use client"

import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, RotateCwIcon } from "lucide-react"
import type { UseQueryResult } from "@tanstack/react-query"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExplorerLink } from "@/components/ui/web3"
import { formatUtc } from "@/components/ui/web3/format"
import type { LedgerEntry } from "./api"
import { KIND_LABEL } from "./copy"

type Source = { url?: unknown; retrievedAt?: unknown; sha256?: unknown }

function short(v: string, n = 10) {
  return v.length > n * 2 + 1 ? `${v.slice(0, n)}…${v.slice(-6)}` : v
}

/** An entry's detail: sources as links with retrieval time and hash, everything else as key: value. */
function Detail({ detail }: { detail: Record<string, unknown> }) {
  const { sources, ...rest } = detail
  return (
    <div className="mt-2 grid gap-2 text-xs">
      {Array.isArray(sources) && sources.length ? (
        <ul className="grid gap-1">
          {(sources as Source[]).map((s, i) => (
            <li key={i} className="break-all">
              {typeof s.url === "string" ? (
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">
                  {s.url}
                </a>
              ) : null}
              {typeof s.retrievedAt === "string" ? <span className="text-muted-foreground"> · retrieved {s.retrievedAt}</span> : null}
              {typeof s.sha256 === "string" ? <span className="font-mono text-muted-foreground"> · sha256 {short(s.sha256)}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="grid gap-0.5">
        {Object.entries(rest).map(([k, v]) => (
          <div key={k} className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-muted-foreground">{k}:</dt>
            <dd className="min-w-0 break-all font-mono">{typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Row({ entry }: { entry: LedgerEntry }) {
  const failed = /\bfailed\b/i.test(entry.summary)
  const fromSnapshot = entry.detail?.from === "snapshot"
  return (
    <div
      role="row"
      data-testid="ledger-row"
      data-kind={entry.kind}
      className="grid gap-1.5 border-b px-1 py-3 last:border-b-0 md:grid-cols-[9rem_minmax(0,1fr)_13rem_10rem] md:gap-4"
    >
      <div role="cell" className="flex flex-wrap items-center gap-1.5">
        {failed ? (
          <CircleXIcon aria-label="Failed" className="size-4 text-destructive" />
        ) : (
          <CircleCheckIcon aria-label="Done" className="size-4 text-success" />
        )}
        <Badge variant="outline" data-testid="ledger-kind">
          {KIND_LABEL[entry.kind] ?? entry.kind}
        </Badge>
        {fromSnapshot ? <Badge variant="secondary">snapshot</Badge> : null}
      </div>
      <div role="cell" className="min-w-0 text-sm">
        <p data-testid="ledger-summary" className="break-words">
          {entry.summary}
        </p>
        {entry.detail && Object.keys(entry.detail).length ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-muted-foreground">Details</summary>
            <Detail detail={entry.detail} />
          </details>
        ) : null}
      </div>
      <div role="cell" className="text-xs tabular-nums md:text-sm">
        <span className="text-muted-foreground md:sr-only">Chain time </span>
        {entry.chainTime > 0 ? formatUtc(entry.chainTime) : "–"}
      </div>
      <div role="cell" className="min-w-0 text-xs md:text-sm">
        <span className="text-muted-foreground md:sr-only">Tx </span>
        {entry.txHash ? <ExplorerLink hash={entry.txHash} /> : <span className="text-muted-foreground">no transaction</span>}
      </div>
    </div>
  )
}

/** Every admin call and its result on this fork, newest first, as an activity table (cards on phones). */
export function LedgerTable({ ledger }: { ledger: UseQueryResult<LedgerEntry[]> }) {
  const entries = ledger.data ? [...ledger.data].reverse() : []
  return (
    <Card data-testid="ledger">
      <CardHeader>
        <CardTitle>
          <h2>Activity and divergence ledger</h2>
        </CardTitle>
        <CardDescription>
          Everything this fork has done that X Layer mainnet did not: deploys, funding, keeper posts, time travel, scenarios and
          resets. Refreshed after every action.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => ledger.refetch()} disabled={ledger.isFetching}>
            <RotateCwIcon aria-hidden />
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {ledger.isError ? (
          <Alert variant="destructive" data-testid="ledger-error">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>The ledger could not be read</AlertTitle>
            <AlertDescription>
              <p className="break-words">{ledger.error.message}</p>
            </AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => ledger.refetch()}>
                Retry
              </Button>
            </AlertAction>
          </Alert>
        ) : ledger.isPending ? (
          <div aria-busy="true" aria-label="Loading the ledger" className="grid gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p data-testid="ledger-empty" className="text-sm text-muted-foreground">
            No entries yet.
          </p>
        ) : (
          <div role="table" aria-label="Sandbox activity" aria-rowcount={entries.length} data-count={entries.length}>
            <div role="rowgroup" className="hidden md:block">
              <div role="row" className="grid grid-cols-[9rem_minmax(0,1fr)_13rem_10rem] gap-4 border-b px-1 pb-2 text-xs font-medium text-muted-foreground">
                <span role="columnheader">Status · kind</span>
                <span role="columnheader">What</span>
                <span role="columnheader">Chain time</span>
                <span role="columnheader">Tx hash</span>
              </div>
            </div>
            <div role="rowgroup" data-testid="ledger-rows">
              {entries.map((e, i) => (
                <Row key={`${entries.length - i}`} entry={e} />
              ))}
            </div>
          </div>
        )}
        {ledger.data ? (
          <p data-testid="ledger-count" className="mt-3 text-xs text-muted-foreground">
            {ledger.data.length} {ledger.data.length === 1 ? "entry" : "entries"}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
