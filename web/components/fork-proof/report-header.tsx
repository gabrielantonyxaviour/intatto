"use client"

import Link from "next/link"
import { ArrowLeftIcon, ClockIcon, RotateCwIcon } from "lucide-react"
import { SANDBOX_CHAIN_ID, XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { LIVE_RPC_URLS } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { reproduceCommand } from "./commands"
import { CommandBlock, CopyButton, Field, Mono } from "./primitives"
import type { ProofInputs } from "./types"
import type { ProofRun } from "./use-fork-proof"

const BLOCK_SOURCE: Record<string, string> = {
  session: "from your sandbox session",
  query: "from ?block=",
  rpc: "reported by the RPC itself (anvil_metadata)",
}

function Summary({ run }: { run: ProofRun }) {
  const all = Object.values(run.checks)
  const count = (s: string) => all.filter((c) => c.status === s).length
  const parts = [
    `${count("pass")} of ${all.length} passed`,
    count("fail") ? `${count("fail")} failed` : null,
    count("unreachable") ? `${count("unreachable")} could not reach an RPC` : null,
    count("running") ? `${count("running")} running` : null,
    count("skipped") ? `${count("skipped")} not run` : null,
  ].filter(Boolean)
  return (
    <p data-slot="proof-summary" role="status" className="text-sm">
      {parts.join(" · ")}
    </p>
  )
}

/** The report's header pins how to reproduce the run: which RPCs, which block, and the local fork command. */
export function ReportHeader({ inputs, run, running, onRerun }: { inputs: ProofInputs; run: ProofRun; running: boolean; onRerun: () => void }) {
  const refUrl = run.reference?.client?.url ?? null
  const fellBack = run.reference?.tried.filter((t) => !t.ok) ?? []
  const chainIdText =
    run.sandboxChainId !== null ? String(run.sandboxChainId) : run.sandboxError ? `unreachable (${run.sandboxError})` : "reading…"
  return (
    <Card className="gap-4">
      <CardHeader className="gap-2">
        <Link href="/sandbox" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-3.5" /> Back to sandbox
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">Fork proof</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Four checks this browser runs directly against the sandbox RPC and a public X Layer RPC, to show the sandbox is X
              Layer mainnet forked at one block with Intatto deployed on top. The Intatto server computes none of them.
            </p>
          </div>
          <Button onClick={onRerun} disabled={running} variant="outline" data-slot="rerun">
            <RotateCwIcon aria-hidden />
            {running ? "Checking…" : "Re-run checks"}
          </Button>
        </div>
        <Summary run={run} />
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-2.5" aria-label="How to reproduce this run">
          <Field label="Sandbox RPC">
            <span className="inline-flex max-w-full items-start gap-1">
              <Mono>{inputs.sandboxRpc}</Mono>
              <CopyButton text={inputs.sandboxRpc} label="sandbox RPC URL" />
            </span>
            <span className="block text-xs text-muted-foreground">
              {inputs.rpcSource === "session" ? "from your sandbox session" : "from ?rpc="}
            </span>
          </Field>
          <Field label="Chain ids">
            <span data-slot="sandbox-chain-id">
              sandbox <span className="tabular-nums">{chainIdText}</span>
            </span>{" "}
            · X Layer {XLAYER_CHAIN_ID}
            <span className="block text-xs text-muted-foreground">
              The sandbox uses its own id ({SANDBOX_CHAIN_ID}) so nothing signed there can be replayed on X Layer.
            </span>
          </Field>
          <Field label="Fork block">
            {run.forkBlock !== null ? (
              <>
                <span className="tabular-nums" data-slot="fork-block">
                  {formatNumber(run.forkBlock)}
                </span>
                <span className="block text-xs text-muted-foreground">{run.blockSource ? BLOCK_SOURCE[run.blockSource] : ""}</span>
                {run.rpcForkBlock !== null && run.rpcForkBlock !== run.forkBlock ? (
                  <span className="block text-xs text-destructive">
                    The RPC reports it was forked at block {formatNumber(run.rpcForkBlock)}.
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">unknown</span>
            )}
          </Field>
          <Field label="X Layer RPC">
            {refUrl ? <Mono>{refUrl}</Mono> : <span className="text-muted-foreground">{run.reference ? "none answered" : "choosing…"}</span>}
            <span className="block text-xs text-muted-foreground">
              Public X Layer RPCs, tried in order: {LIVE_RPC_URLS.join(", ")}.
              {fellBack.length > 0 ? ` Skipped: ${fellBack.map((t) => `${t.url} (${t.note})`).join("; ")}.` : ""}
            </span>
          </Field>
          <Field label="Run">
            <span className="inline-flex items-center gap-1">
              <ClockIcon aria-hidden className="size-3.5 text-muted-foreground" />
              started {formatUtc(Math.floor(run.startedAt / 1000))} in this browser
            </span>
          </Field>
        </dl>
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Reproduce locally</p>
          <CommandBlock lines={[reproduceCommand(refUrl ?? LIVE_RPC_URLS[0]!, run.forkBlock)]} label="reproduce command" />
          <p className="text-xs text-muted-foreground">
            Starts your own fork of X Layer at the same block with the sandbox chain id; each check below lists the cast commands to
            compare it, or this sandbox, with X Layer.
          </p>
        </div>
        <Alert variant="info">
          <AlertTitle className="line-clamp-none">Time after the fork block is a simulation</AlertTitle>
          <AlertDescription>
            <p>
              Everything after block {run.forkBlock !== null ? formatNumber(run.forkBlock) : "the fork block"} (warps to a weekend,
              replayed prices, scenario actions) is simulated by definition: it is not X Layer history. These checks prove the
              starting state and the code; the ledger lists what the sandbox changed since.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
