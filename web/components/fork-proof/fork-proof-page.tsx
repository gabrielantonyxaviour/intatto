"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useIntatto } from "@/lib/chain"
import { formatNumber } from "@/components/ui/web3/format"
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
        proves={`The fork block and the blocks 1, 10 and 100 before it have the same hash on both RPCs, so the sandbox shares X Layer's history up to ${at}.`}
        outcome={run.checks.blocks}
        evidence={(e) => <BlocksEvidenceView e={e} />}
        commands={rpcs ? (e) => blockCommands(rpcs, e) : undefined}
        differences={(e) => e.rows.filter((r) => !r.equal).map((r) => `Block ${formatNumber(r.number)} has a different hash`)}
      />
      <CheckSection
        id="bytecode"
        number={2}
        title="Contract code matches X Layer"
        proves={`Every external contract Intatto relies on has the same runtime code on X Layer at ${at}, on the sandbox at that block, and on the sandbox now.`}
        outcome={run.checks.bytecode}
        evidence={(e) => <BytecodeEvidenceView e={e} forkBlock={block ?? 0n} />}
        commands={rpcs ? (e) => bytecodeCommands(rpcs, e) : undefined}
        differences={(e) => e.rows.filter((r) => !r.equal).map((r) => `${r.label} (${r.address})`)}
      />
      <CheckSection
        id="state"
        number={3}
        title="State matches X Layer"
        proves={`Balances, prices and storage read at ${at} are equal on both RPCs, and storage the sandbox never writes is still what X Layer had.`}
        outcome={run.checks.state}
        evidence={(e) => <StateEvidenceView e={e} forkBlock={block ?? 0n} />}
        commands={rpcs ? (e) => stateCommands(rpcs, e) : undefined}
        differences={(e) => [
          ...e.atFork.filter((r) => !r.equal).map((r) => `At the fork block: ${r.contract} ${r.what}${r.note ? ` (${r.note})` : ""}`),
          ...e.untouched.filter((r) => !r.equal).map((r) => `Changed since the fork: ${r.contract} ${r.what}${r.note ? ` (${r.note})` : ""}`),
          ...e.explained.filter((r) => r.verdict === "unexplained").map((r) => `Changed with no ledger entry: ${r.contract} ${r.what}`),
        ]}
      />
      <CheckSection
        id="intatto"
        number={4}
        title="Intatto's code is the published code"
        proves="Each Intatto contract on the sandbox runs the same code as the build (or the mainnet deployment, once it exists)."
        outcome={run.checks.intatto}
        evidence={(e) => <IntattoEvidenceView e={e} />}
        commands={rpcs ? (e) => intattoCommands(rpcs, e) : undefined}
        differences={(e) => [
          ...e.rows.filter((r) => !r.equal).map((r) => `${r.label} (${r.contract}) at ${r.address}`),
          ...e.missing,
        ]}
      />
      <LedgerSection ledger={run.ledger} />
    </div>
  )
}
