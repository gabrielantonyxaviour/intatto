"use client"

import { CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react"
import type { UseQueryResult } from "@tanstack/react-query"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EvidenceSheet } from "@/components/ui/ix"
import { ExplorerLink } from "@/components/ui/web3"
import { formatUtc } from "@/components/ui/web3/format"
import type { LedgerEntry } from "./api"
import { KIND_LABEL } from "./copy"

type Source = { url?: unknown; retrievedAt?: unknown; sha256?: unknown }

function shortHash(v: string) {
  return v.length > 21 ? `${v.slice(0, 10)}…${v.slice(-6)}` : v
}

/** Sources and other fields, expanded. No second disclosure inside the ledger sheet. */
function Detail({ detail }: { detail: Record<string, unknown> }) {
  const { sources, ...rest } = detail
  return (
    <div className="mt-2 grid gap-2 text-xs">
      {Array.isArray(sources) && sources.length ? (
        <ul className="grid gap-1">
          {(sources as Source[]).map((s, i) => (
            <li key={i} className="break-all" data-testid="ledger-source">
              {typeof s.url === "string" ? (
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">
                  {s.url}
                </a>
              ) : null}
              {typeof s.retrievedAt === "string" ? <span className="text-muted-foreground"> · retrieved {s.retrievedAt}</span> : null}
              {typeof s.sha256 === "string" ? <span className="font-mono text-muted-foreground"> · sha256 {shortHash(s.sha256)}</span> : null}
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
    <div role="row" data-testid="ledger-row" data-kind={entry.kind} className="grid gap-1.5 border-b py-3 last:border-b-0">
      <div role="cell" className="flex flex-wrap items-center gap-1.5">
        {failed ? <CircleXIcon aria-label="Failed" className="size-4 text-destructive" /> : <CircleCheckIcon aria-label="Done" className="size-4 text-success" />}
        <Badge variant="outline" data-testid="ledger-kind">
          {KIND_LABEL[entry.kind] ?? entry.kind}
        </Badge>
        {fromSnapshot ? <Badge variant="secondary">snapshot</Badge> : null}
        <span className="text-xs text-muted-foreground tabular-nums">{entry.chainTime > 0 ? formatUtc(entry.chainTime) : "no chain time"}</span>
      </div>
      <div role="cell" className="min-w-0 text-sm">
        <p data-testid="ledger-summary" className="break-words">
          {entry.summary}
        </p>
        {entry.detail && Object.keys(entry.detail).length ? <Detail detail={entry.detail} /> : null}
      </div>
      <div role="cell" className="min-w-0 text-xs">
        {entry.txHash ? <ExplorerLink hash={entry.txHash} /> : <span className="text-muted-foreground">no transaction</span>}
      </div>
    </div>
  )
}

/** A short preview plus the full API ledger in one sheet. Rows are not a second disclosure. */
export function LedgerPanel({ ledger, asOf }: { ledger: UseQueryResult<LedgerEntry[]>; asOf?: string }) {
  const entries = ledger.data ? [...ledger.data].reverse() : []
  const preview = entries.slice(0, 3)
  const state = ledger.isError ? "unavailable" : ledger.isPending ? "fetching" : entries.length === 0 ? "empty" : "ready"
  return (
    <section className="grid gap-3" aria-label="Recent activity">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="grid gap-1">
          <h2 className="text-base font-medium">Recent activity</h2>
          <p className="text-sm text-muted-foreground">A preview. The ledger is the full list, including seeded funding and replay labels.</p>
        </div>
        <EvidenceSheet
          title="Activity ledger"
          summary="Every call on this fork from the session ledger, newest first. Seeded funding and replay fixtures stay labelled; they are not organic mainnet activity."
          asOf={asOf}
          state={state}
          triggerLabel="View ledger"
          testId="ledger"
          statusMessage={ledger.isError ? ledger.error.message : undefined}
          onRetry={() => void ledger.refetch()}
        >
          <div role="table" aria-label="Sandbox activity" aria-rowcount={entries.length} data-count={entries.length}>
            <div role="rowgroup" data-testid="ledger-rows">
              {entries.map((e, i) => (
                <Row key={`${entries.length - i}`} entry={e} />
              ))}
            </div>
          </div>
          <p data-testid="ledger-count" className="mt-3 text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
        </EvidenceSheet>
      </div>
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
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Loading the ledger…
        </p>
      ) : preview.length === 0 ? (
        <p data-testid="ledger-empty" className="text-sm text-muted-foreground">
          No entries yet.
        </p>
      ) : (
        <ul data-testid="ledger-preview" className="grid gap-2 text-sm">
          {preview.map((e) => (
            <li key={e.at + e.summary} className="flex min-w-0 flex-wrap items-baseline gap-2">
              <Badge variant="outline">{KIND_LABEL[e.kind] ?? e.kind}</Badge>
              <span className="min-w-0 break-words">{e.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
