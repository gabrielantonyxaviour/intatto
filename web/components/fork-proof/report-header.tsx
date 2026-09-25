"use client"

import Link from "next/link"
import { ArrowLeftIcon, RotateCwIcon } from "lucide-react"
import { XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { Field } from "./primitives"
import type { ProofInputs } from "./types"
import type { ProofRun } from "./use-fork-proof"

function Summary({ run }: { run: ProofRun }) {
  const all = Object.values(run.checks)
  const count = (s: string) => all.filter((c) => c.status === s).length
  const parts = [
    `${count("pass")} of ${all.length} passed`,
    count("fail") ? `${count("fail")} failed` : null,
    count("unreachable") ? `${count("unreachable")} could not reach an RPC` : null,
    count("refused") ? `${count("refused")} had a read refused by an RPC` : null,
    count("running") ? `${count("running")} running` : null,
    count("skipped") ? `${count("skipped")} not run` : null,
  ].filter(Boolean)
  return <p data-slot="proof-summary" role="status" className="text-sm">{parts.join(" · ")}</p>
}

/** Identity and limits remain visible; raw reproduction inputs sit after the four checks. */
export function ReportHeader({ inputs, run, running, onRerun }: { inputs: ProofInputs; run: ProofRun; running: boolean; onRerun: () => void }) {
  const chainIdText = run.sandboxChainId !== null ? String(run.sandboxChainId) : run.sandboxError ? "unreachable" : "reading…"
  const source = inputs.rpcSource === "session" && run.blockSource === "session"
    ? "Identity from your sandbox session"
    : `RPC from ${inputs.rpcSource === "session" ? "your session" : "?rpc="}; fork block from ${run.blockSource === "query" ? "?block=" : run.blockSource === "rpc" ? "anvil_metadata" : run.blockSource === "session" ? "your session" : "an unavailable source"}`
  return (
    <Card className="gap-3">
      <CardHeader className="gap-2">
        <Link href="/sandbox" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-3.5" /> Back to sandbox
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">Fork proof</h1>
            <p className="text-sm text-muted-foreground">Four checks run directly in your browser against the sandbox and X Layer RPCs.</p>
          </div>
          <Button onClick={onRerun} disabled={running} variant="outline" data-slot="rerun">
            <RotateCwIcon aria-hidden />{running ? "Checking…" : "Re-run checks"}
          </Button>
        </div>
        <Summary run={run} />
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        <p className="text-xs text-muted-foreground">{source}</p>
        <dl className="grid min-w-0 gap-2" aria-label="Proof identity">
          <Field label="Chain ids">
            <span data-slot="sandbox-chain-id">sandbox {chainIdText}</span> · X Layer {XLAYER_CHAIN_ID} (reference)
          </Field>
          <Field label="Fork block">
            <span className="tabular-nums" data-slot="fork-block">{run.forkBlock !== null ? formatNumber(run.forkBlock) : "unknown"}</span>
            {run.rpcForkBlock !== null && run.rpcForkBlock !== run.forkBlock ? (
              <p className="text-sm text-destructive">The RPC reports it was forked at block {formatNumber(run.rpcForkBlock)}.</p>
            ) : null}
          </Field>
          <Field label="Run">started {formatUtc(Math.floor(run.startedAt / 1000))} in this browser</Field>
        </dl>
        <Alert variant="info">
          <AlertTitle className="line-clamp-none">Time after the fork block is a simulation</AlertTitle>
          <AlertDescription>
            Later transactions, replayed prices and time travel are not X Layer history. These checks compare specific reads and code, not every sandbox change.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
