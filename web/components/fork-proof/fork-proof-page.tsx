"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useIntatto } from "@/lib/chain"
import { EvidenceSheet } from "@/components/ui/ix"
import { ReproductionDetails } from "./reproduction-details"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { CheckSection } from "./check-section"
import { blockCommands, bytecodeCommands, intattoCommands, stateCommands, type Rpcs } from "./commands"
import { BlocksEvidenceView, BytecodeEvidenceView } from "./evidence-chain"
import { IntattoEvidenceView } from "./evidence-intatto"
import { StateEvidenceView } from "./evidence-state"
import { LedgerSection } from "./ledger-section"
import { blockSchema, NoSandbox, rpcUrlSchema } from "./no-sandbox"
import { ReportHeader } from "./report-header"
import type { ProofInputs } from "./types"
import { useForkProof } from "./use-fork-proof"

type Resolved = { inputs: ProofInputs } | { inputs: null; invalid: string | null }

/** The sandbox RPC and fork block come from `?rpc=` / `?block=` when given, otherwise from the sandbox session. */
function useProofInputs(): Resolved {
  const { sandbox } = useIntatto()
  const params = useSearchParams()
  const rpcParam = params?.get("rpc") ?? null
  const blockParam = params?.get("block") ?? null
  return useMemo<Resolved>(() => {
    const rpc = rpcParam ? rpcUrlSchema.safeParse(rpcParam) : null
    if (rpc && !rpc.success) return { inputs: null, invalid: `?rpc= is not usable: ${rpc.error.issues[0]?.message}` }
    const block = blockParam ? blockSchema.safeParse(blockParam) : null
    if (block && !block.success) return { inputs: null, invalid: `?block= is not usable: ${block.error.issues[0]?.message}` }
    const sandboxRpc = rpc?.data ?? sandbox?.rpcUrl ?? null
    if (!sandboxRpc) return { inputs: null, invalid: null }
    const forkBlock = block?.success ? BigInt(block.data) : sandbox ? BigInt(sandbox.forkBlock) : null
    return {
      inputs: {
        sandboxRpc,
        rpcSource: rpc ? "query" : "session",
        forkBlock,
        blockSource: block ? "query" : sandbox ? "session" : null,
        sessionId: sandbox?.sessionId ?? null,
        apiUrl: sandbox?.apiUrl ?? null,
        deployment: sandbox?.deployment ?? null,
      },
    }
  }, [sandbox, rpcParam, blockParam])
}

export function ForkProofPage() {
  const resolved = useProofInputs()
  if (!resolved.inputs) return <NoSandbox invalid={resolved.invalid} />
  return <ProofReport inputs={resolved.inputs} />
}

function ProofReport({ inputs }: { inputs: ProofInputs }) {
  const { run, rerun, running } = useForkProof(inputs)
  const block = run.forkBlock
  const at = block !== null ? `block ${formatNumber(block)}` : "the fork block"
  const rpcs: Rpcs | null = block !== null && run.reference?.client ? { sandbox: inputs.sandboxRpc, reference: run.reference.client.url, forkBlock: block } : null

  return (
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-4" data-run={run.id}>
      <ReportHeader inputs={inputs} run={run} running={running} onRerun={() => void rerun()} />
      <CheckSection
        id="blocks"
        number={1}
        title="Block hashes match X Layer"
        proves={`Block hashes on both RPCs, ending at ${at}.`}
        summary={(e) => `${e.rows.filter((r) => r.equal).length} of ${e.rows.length} block hashes match`}
        outcome={run.checks.blocks}
        evidence={(e) => <BlocksEvidenceView e={e} />}
        commands={rpcs ? (e) => blockCommands(rpcs, e) : undefined}
        differences={(e) => e.rows.filter((r) => !r.equal).map((r) => `Block ${formatNumber(r.number)} has a different hash`)}
      />
      <CheckSection
        id="bytecode"
        number={2}
        title="Contract code matches X Layer"
        proves={`External contract code: sandbox now versus X Layer at ${at}.`}
        summary={(e) => `${e.rows.filter((r) => r.equal).length} of ${e.rows.length} addresses match${e.omitted.length ? ` · ${e.omitted.length} not covered` : ""}`}
        outcome={run.checks.bytecode}
        evidence={(e) => <BytecodeEvidenceView e={e} forkBlock={block ?? 0n} />}
        commands={rpcs ? (e) => bytecodeCommands(rpcs, e) : undefined}
        differences={(e) => e.rows.filter((r) => !r.equal).map((r) => `${r.label} (${r.address})`)}
      />
      <CheckSection
        id="state"
        number={3}
        title="State matches X Layer"
        proves={`Unchanged state: sandbox now versus X Layer at ${at}. Moving values are listed separately and do not affect this verdict.`}
        summary={(e) => `${e.unchanged.filter((r) => r.equal).length} of ${e.unchanged.length} unchanged reads match · ${e.moving.length} moving values listed separately`}
        outcome={run.checks.state}
        evidence={(e) => <StateEvidenceView e={e} forkBlock={block ?? 0n} />}
        commands={rpcs ? (e) => stateCommands(rpcs, e) : undefined}
        differences={(e) =>
          e.unchanged.filter((r) => !r.equal).map((r) => `Changed since the fork: ${r.contract} ${r.what}${r.note ? ` (${r.note})` : ""}`)
        }
      />
      <CheckSection
        id="intatto"
        number={4}
        title="Intatto's code is the published code"
        proves="Sandbox code versus the configured mainnet deployment or labelled build artifacts."
        summary={(e) => `${e.rows.filter((r) => r.equal).length} of ${e.rows.length} contracts match · ${e.comparison === "mainnet" ? "mainnet and sandbox-only build references" : "build artifacts"}`}
        outcome={run.checks.intatto}
        evidence={(e) => <IntattoEvidenceView e={e} />}
        commands={rpcs ? (e) => intattoCommands(rpcs, e) : undefined}
        differences={(e) => e.rows.filter((r) => !r.equal).map((r) => `${r.label} (${r.contract}) at ${r.address}`)}
      />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2" aria-label="Proof sources and reproduction">
        <EvidenceSheet title="Reproduce locally" triggerLabel="Reproduce locally" state="ready"
          summary="RPC inputs and read heights for this browser run."
          asOf={`Started ${formatUtc(Math.floor(run.startedAt / 1000))}`} evidenceFor="reproduction">
          <ReproductionDetails inputs={inputs} run={run} />
        </EvidenceSheet>
        <LedgerSection ledger={run.ledger} asOf={`Run started ${formatUtc(Math.floor(run.startedAt / 1000))}`} />
      </div>
    </div>
  )
}
