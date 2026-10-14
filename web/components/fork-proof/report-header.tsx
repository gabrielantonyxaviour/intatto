"use client"

import { RotateCwIcon } from "lucide-react"
import { XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { Button } from "@/components/ui/button"
import { SandboxPageHeader } from "@/components/sandbox/page-header"
import { RelativeTime } from "@/components/sandbox/display"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { Field } from "./primitives"
import type { ProofInputs } from "./types"
import type { ProofRun } from "./use-fork-proof"

function Summary({ run }: { run: ProofRun }) {
  const all = Object.values(run.checks)
  const count = (s: string) => all.filter((c) => c.status === s).length
  const parts = [
    `${count("pass")} of ${all.length} checks passed`,
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
    <div className="grid gap-4">
      <SandboxPageHeader title="Fork proof" description={<Summary run={run} />}>
        <Button onClick={onRerun} disabled={running} variant="outline" data-slot="rerun"><RotateCwIcon aria-hidden />{running ? "Checking…" : "Re-run checks"}</Button>
      </SandboxPageHeader>
      <div className="grid gap-3 rounded-xl border p-4 sm:p-6">
        <p className="text-sm">Four browser checks compare your fork with X Layer.</p>
        <p className="text-xs text-muted-foreground">Time after the fork is a simulation; these checks do not verify every sandbox change.</p>
        <details className="min-w-0">
          <summary className="cursor-pointer text-sm text-muted-foreground">Run details · <RelativeTime timestamp={run.startedAt / 1000} /></summary>
          <p className="my-3 text-xs text-muted-foreground">{source}</p>
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
        </details>
      </div>
    </div>
  )
}
