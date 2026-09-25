/**
 * Check 3: the sandbox's current state equals X Layer's at the fork block, apart from changes its ledger lists.
 *  a. contract reads and raw storage no sandbox action writes: sandbox now must equal X Layer at the fork block;
 *  b. values ordinary sandbox use moves (balances, the pool price, the multiplier): listed apart with the ledger
 *     entries that explain them, never a failure.
 * The sandbox is read at its latest block: a sandbox started from a state snapshot cannot serve state at the fork
 * block itself, and "now" is what a borrower on the sandbox actually meets.
 */
import type { Hex } from "viem"
import type { LedgerRow, LedgerState } from "./ledger"
import { getSlot, type ProofClient } from "./rpc"
import { MOVING, UNCHANGED_CALLS, UNCHANGED_SLOTS, type CallTarget, type SlotTarget } from "./targets"
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

export type MovingRow = ValueRow & { why: string; ledger: LedgerState["status"]; explanations: LedgerRow[] }

export type StateEvidence = { unchanged: ValueRow[]; moving: MovingRow[] }

async function slotRow(t: SlotTarget, reference: ProofClient, sandbox: ProofClient, forkBlock: bigint): Promise<ValueRow> {
  const [r, s] = await Promise.all([getSlot(reference, t.address, t.slot, forkBlock), getSlot(sandbox, t.address, t.slot, "latest")])
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

async function callRow(t: CallTarget, reference: ProofClient, sandbox: ProofClient, forkBlock: bigint): Promise<ValueRow> {
  const [r, s] = await Promise.all([readCall(reference, t, forkBlock), readCall(sandbox, t, "latest")])
  return { id: t.id, contract: t.contract, address: t.address, what: t.label, note: null, slot: null, reference: r, sandbox: s, equal: r.raw === s.raw }
}

export async function checkState(sandbox: ProofClient, reference: ProofClient, forkBlock: bigint, ledger: LedgerState) {
  const entries = ledger.status === "ok" ? ledger.entries : []
  const [calls, slots, moving] = await Promise.all([
    Promise.all(UNCHANGED_CALLS.map((t) => callRow(t, reference, sandbox, forkBlock))),
    Promise.all(UNCHANGED_SLOTS.map((t) => slotRow(t, reference, sandbox, forkBlock))),
    Promise.all(
      MOVING.map(async (t): Promise<MovingRow> => {
        const row = await callRow(t, reference, sandbox, forkBlock)
        const explanations = row.equal ? [] : entries.filter((e) => t.explainedBy.test(e.summary))
        return { ...row, why: t.why, ledger: ledger.status, explanations }
      }),
    ),
  ])
  const unchanged = [...calls, ...slots]
  return { pass: unchanged.every((r) => r.equal), evidence: { unchanged, moving } satisfies StateEvidence }
}
