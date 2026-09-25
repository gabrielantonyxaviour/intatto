"use client"

import { LIVE_RPC_URLS } from "@/lib/chain"
import { reproduceCommand } from "./commands"
import { CommandBlock, CopyButton, Field, Mono } from "./primitives"
import type { ProofInputs } from "./types"
import type { ProofRun } from "./use-fork-proof"

/** Complete reproduction inputs; the caller puts these in one directly opened evidence sheet. */
export function ReproductionDetails({ inputs, run }: { inputs: ProofInputs; run: ProofRun }) {
  const refUrl = run.reference?.client?.url ?? null
  const fellBack = run.reference?.tried.filter((t) => !t.ok) ?? []
  return (
    <div className="grid min-w-0 gap-4">
      <dl className="grid min-w-0 gap-3">
        <Field label="Sandbox RPC">
          <span className="inline-flex max-w-full items-start gap-1">
            <Mono>{inputs.sandboxRpc}</Mono>
            <CopyButton text={inputs.sandboxRpc} label="sandbox RPC URL" />
          </span>
        </Field>
        <Field label="X Layer RPC">
          {refUrl ? (
            <span className="inline-flex max-w-full items-start gap-1">
              <Mono>{refUrl}</Mono><CopyButton text={refUrl} label="X Layer RPC URL" />
            </span>
          ) : <span>{run.reference ? "none answered" : "choosing…"}</span>}
        </Field>
        <Field label="RPC fallbacks">
          <p className="wrap-anywhere">Public X Layer RPCs, tried in order: {LIVE_RPC_URLS.join(", ")}.</p>
          {fellBack.length > 0 ? <p className="wrap-anywhere">Skipped: {fellBack.map((t) => `${t.url} (${t.note})`).join("; ")}.</p> : null}
        </Field>
        <Field label="Read heights">
          Block hashes use the same block number on both RPCs. External code and state compare the sandbox now with X Layer
          at the fork block. Intatto code compares with mainnet now or the labelled build artifacts.
        </Field>
      </dl>
      <p className="text-sm text-muted-foreground">
        A sandbox loaded from a snapshot cannot serve its state at the fork block. Each check names the heights it compares.
      </p>
      <CommandBlock lines={[reproduceCommand(refUrl ?? LIVE_RPC_URLS[0]!, run.forkBlock)]} label="reproduce command" />
    </div>
  )
}
