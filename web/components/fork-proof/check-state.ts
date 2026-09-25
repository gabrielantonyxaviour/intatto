/**
 * Check 3, in three parts:
 *  a. state read at the fork block is equal on both RPCs (contract calls and raw storage words);
 *  b. storage no sandbox action writes, read on the sandbox NOW, still equals X Layer at the fork block;
 *  c. values the sandbox is expected to change, listed apart with the ledger entries that explain them.
 */
import type { Hex } from "viem"
import type { LedgerRow, LedgerState } from "./ledger"
import { getSlot, type BlockRef, type ProofClient } from "./rpc"
import { FORK_BLOCK_CALLS, FORK_BLOCK_SLOTS, LEDGER_EXPLAINED, UNTOUCHED_SLOTS, type ExplainedTarget, type SlotTarget } from "./targets"
import { decodeSlot, readCall, type ReadValue } from "./values"

export type ValueRow = {
  id: string
  contract: string
  address: Hex
  /** "totalSupply()" or "slot 0x2". */
  what: string
  /** What a raw slot holds, e.g. "totalSupply". */
  note: string | null
  slot: Hex | null
  reference: ReadValue
  sandbox: ReadValue
  equal: boolean
}

export type Verdict = "unchanged" | "explained" | "expected" | "unexplained" | "no-ledger"

export type ExplainedRow = ValueRow & {
  changedBy: ExplainedTarget["changedBy"]
  why: string
  verdict: Verdict
  explanations: LedgerRow[]
}

export type StateEvidence = { atFork: ValueRow[]; untouched: ValueRow[]; explained: ExplainedRow[] }

async function slotRow(t: SlotTarget, reference: ProofClient, refBlock: BlockRef, sandbox: ProofClient, sandboxBlock: BlockRef): Promise<ValueRow> {
  const [r, s] = await Promise.all([getSlot(reference, t.address, t.slot, refBlock), getSlot(sandbox, t.address, t.slot, sandboxBlock)])
  return {
    id: t.id,
    contract: t.contract,
    address: t.address,
    what: `slot ${t.slot.length > 10 ? `${t.slot.slice(0, 10)}…` : t.slot}`,
    note: t.name,
    slot: t.slot,
    reference: { raw: r, shown: decodeSlot(r, t.decode) },
    sandbox: { raw: s, shown: decodeSlot(s, t.decode) },
    equal: r === s,
  }
}

function verdictFor(t: ExplainedTarget, equal: boolean, ledger: LedgerState): { verdict: Verdict; explanations: LedgerRow[] } {
  const explanations = ledger.status === "ok" ? ledger.entries.filter((e) => t.explainedBy.test(e.summary)) : []
  if (equal) return { verdict: "unchanged", explanations: [] }
  if (t.changedBy === "transactions") return { verdict: "expected", explanations }
  if (ledger.status !== "ok") return { verdict: "no-ledger", explanations }
  return { verdict: explanations.length > 0 ? "explained" : "unexplained", explanations }
}

export async function checkState(sandbox: ProofClient, reference: ProofClient, forkBlock: bigint, ledger: LedgerState) {
  const callRow = async (t: (typeof FORK_BLOCK_CALLS)[number], sandboxBlock: BlockRef): Promise<ValueRow> => {
    const [r, s] = await Promise.all([readCall(reference, t, forkBlock), readCall(sandbox, t, sandboxBlock)])
    return { id: t.id, contract: t.contract, address: t.address, what: t.label, note: null, slot: null, reference: r, sandbox: s, equal: r.raw === s.raw }
  }

  const [calls, slots, untouched, explained] = await Promise.all([
    Promise.all(FORK_BLOCK_CALLS.map((t) => callRow(t, forkBlock))),
    Promise.all(FORK_BLOCK_SLOTS.map((t) => slotRow(t, reference, forkBlock, sandbox, forkBlock))),
    Promise.all(UNTOUCHED_SLOTS.map((t) => slotRow(t, reference, forkBlock, sandbox, "latest"))),
    Promise.all(
      LEDGER_EXPLAINED.map(async (t): Promise<ExplainedRow> => {
        const row = await callRow(t, "latest")
        return { ...row, changedBy: t.changedBy, why: t.why, ...verdictFor(t, row.equal, ledger) }
      }),
    ),
  ])
  const atFork = [...calls, ...slots]
  const pass = atFork.every((r) => r.equal) && untouched.every((r) => r.equal) && !explained.some((r) => r.verdict === "unexplained")
  return { pass, evidence: { atFork, untouched, explained } satisfies StateEvidence }
}
