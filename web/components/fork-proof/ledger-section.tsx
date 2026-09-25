"use client"

import { CircleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExplorerLink, formatUtc } from "@/components/ui/web3"
import type { LedgerState } from "./ledger"
import { Mono } from "./primitives"

/** Every change the sandbox made on top of X Layer, as the session recorded it. */
export function LedgerSection({ ledger }: { ledger: LedgerState }) {
  return (
    <Card aria-labelledby="ledger-title" data-slot="ledger" data-ledger={ledger.status} className="gap-3">
      <CardHeader className="gap-1.5">
        <h2 id="ledger-title" className="text-base font-medium">
          Divergence ledger
        </h2>
        <CardDescription>
          Every departure from X Layer a session makes: funding moved from real holders by impersonation, time warps, keeper
          posts, and replayed scenarios with their data sources and hashes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        {ledger.status === "loading" ? (
          <div aria-busy="true" aria-label="Loading the ledger" className="grid gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {ledger.status === "none" ? <p className="text-sm text-muted-foreground">{ledger.reason}</p> : null}
        {ledger.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertTitle className="line-clamp-none">The ledger could not be loaded</AlertTitle>
            <AlertDescription>
              <p className="wrap-anywhere">
                {ledger.url}: {ledger.message}
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
        {ledger.status === "ok" && ledger.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">The ledger is empty: this session has not changed anything yet.</p>
        ) : null}
        {ledger.status === "ok" && ledger.entries.length > 0 ? (
          <>
            <p className="min-w-0 text-xs text-muted-foreground wrap-anywhere">
              {ledger.entries.length} entries from <Mono>{ledger.url}</Mono>
            </p>
            <ol className="grid min-w-0 gap-2">
              {ledger.entries.map((e, i) => (
                <li key={i} className="grid min-w-0 gap-1 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{e.kind}</Badge>
                    {e.chainTime ? <span className="text-xs text-muted-foreground tabular-nums">chain time {formatUtc(e.chainTime)}</span> : null}
                  </div>
                  <p className="min-w-0 wrap-anywhere">{e.summary}</p>
                  {e.txHash ? (
                    <p className="min-w-0 text-xs text-muted-foreground wrap-anywhere">
                      tx <ExplorerLink hash={e.txHash} className="font-mono break-all" />
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
