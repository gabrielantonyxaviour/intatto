"use client"

import { Badge } from "@/components/ui/badge"
import { EvidenceSheet, type EvidenceState } from "@/components/ui/ix"
import { ExplorerLink, formatUtc } from "@/components/ui/web3"
import type { LedgerState } from "./ledger"
import { Mono } from "./primitives"

function ledgerSummary(ledger: LedgerState): { state: EvidenceState; message: string } {
  switch (ledger.status) {
    case "loading": return { state: "fetching", message: "Loading the divergence ledger…" }
    case "none": return { state: "unavailable", message: ledger.reason }
    case "error": return { state: "unavailable", message: `The ledger could not be loaded: ${ledger.url}: ${ledger.message}` }
    case "ok": return ledger.entries.length
      ? { state: "ready", message: `${ledger.entries.length} recorded changes` }
      : { state: "empty", message: "The ledger is empty: no recorded changes in this session." }
  }
}

/** The full API ledger, including provenance, is one click away; unavailable evidence stays visible. */
export function LedgerSection({ ledger, asOf }: { ledger: LedgerState; asOf: string }) {
  const { state, message } = ledgerSummary(ledger)
  const source = "url" in ledger ? `Session API: ${ledger.url}` : "The divergence ledger comes from the sandbox session API."
  return (
    <div className="grid min-w-0 content-start gap-2" data-ledger-status={ledger.status}>
      <EvidenceSheet title="Divergence ledger" triggerLabel="View ledger" summary={source}
        state={state} statusMessage={message} asOf={asOf} evidenceFor="ledger">
        {ledger.status === "ok" ? (
          <div className="grid min-w-0 gap-3" data-slot="ledger" data-ledger={ledger.status}>
            <p className="text-sm">Funding, time travel, keeper posts and scenarios recorded by this session. These are sandbox changes, not X Layer history.</p>
            <p className="text-xs text-muted-foreground wrap-anywhere">{ledger.entries.length} entries from <Mono>{ledger.url}</Mono></p>
            <ol className="grid min-w-0 gap-2">
              {ledger.entries.map((e, i) => (
                <li key={i} data-ledger-row={i} className="grid min-w-0 gap-1 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{e.kind}</Badge>
                    {e.chainTime !== null ? <span className="text-xs text-muted-foreground tabular-nums">chain time {formatUtc(e.chainTime)}</span> : null}
                  </div>
                  <p className="wrap-anywhere">{e.summary}</p>
                  {e.at ? <p className="text-xs text-muted-foreground">Recorded at {e.at}</p> : null}
                  {e.detail ? <pre className="min-w-0 whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 text-xs" aria-label="Ledger source details">{JSON.stringify(e.detail, null, 2)}</pre> : null}
                  {e.txHash ? <p className="text-xs text-muted-foreground wrap-anywhere">tx <ExplorerLink hash={e.txHash} className="font-mono break-all" /></p> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </EvidenceSheet>
      <p className={`text-sm wrap-anywhere ${state === "unavailable" ? "text-warning-foreground" : "text-muted-foreground"}`} role={state === "unavailable" ? "status" : undefined}>{message}</p>
    </div>
  )
}
