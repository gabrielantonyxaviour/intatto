/** Foundry `cast` commands that reproduce each check from a terminal, with the exact RPCs and block. */
import type { AbiFunction } from "viem"
import { SANDBOX_CHAIN_ID } from "@intatto/config/xlayer"
import type { BlocksEvidence } from "./check-blocks"
import type { BytecodeEvidence } from "./check-bytecode"
import type { IntattoEvidence } from "./check-intatto"
import type { StateEvidence } from "./check-state"
import { abi, FORK_BLOCK_CALLS, LEDGER_EXPLAINED } from "./targets"

const q = (url: string) => (/^[\w:/.\-]+$/.test(url) ? url : `'${url.replace(/'/g, `'\\''`)}'`)

export type Rpcs = { sandbox: string; reference: string; forkBlock: bigint }

export function reproduceCommand(referenceUrl: string, forkBlock: bigint | null, chainId = SANDBOX_CHAIN_ID): string {
  return `anvil --fork-url ${q(referenceUrl)} --fork-block-number ${forkBlock ?? "<fork block>"} --chain-id ${chainId}`
}

export function blockCommands(r: Rpcs, e: BlocksEvidence): string[] {
  return e.rows.flatMap((row) => [
    `cast block ${row.number} --field hash --rpc-url ${q(r.sandbox)}`,
    `cast block ${row.number} --field hash --rpc-url ${q(r.reference)}`,
  ])
}

export function bytecodeCommands(r: Rpcs, e: BytecodeEvidence): string[] {
  return e.rows.flatMap((row) => [
    `# ${row.label}`,
    `cast keccak $(cast code ${row.address} --block ${r.forkBlock} --rpc-url ${q(r.reference)})`,
    `cast keccak $(cast code ${row.address} --block ${r.forkBlock} --rpc-url ${q(r.sandbox)})`,
    `cast keccak $(cast code ${row.address} --rpc-url ${q(r.sandbox)})`,
  ])
}

const byId = new Map([...FORK_BLOCK_CALLS, ...LEDGER_EXPLAINED].map((t) => [t.id, t]))

/** "slot0()(uint160,int24,…)" plus its arguments, the way cast call wants them. */
function castSig(id: string): string | null {
  const t = byId.get(id)
  if (!t) return null
  const item = (abi as readonly AbiFunction[]).find((x) => x.name === t.fn)
  if (!item) return null
  const sig = `"${t.fn}(${item.inputs.map((i) => i.type).join(",")})(${item.outputs.map((o) => o.type).join(",")})"`
  return [sig, ...(t.args ?? []).map(String)].join(" ")
}

export function stateCommands(r: Rpcs, e: StateEvidence): string[] {
  const read = (row: StateEvidence["atFork"][number], block: string, rpc: string) =>
    row.slot ? `cast storage ${row.address} ${row.slot}${block} --rpc-url ${q(rpc)}` : `cast call ${row.address} ${castSig(row.id)}${block} --rpc-url ${q(rpc)}`
  const at = ` --block ${r.forkBlock}`
  return [
    "# a. at the fork block, on both RPCs",
    ...e.atFork.flatMap((row) => [read(row, at, r.reference), read(row, at, r.sandbox)]),
    "# b. never written by the sandbox: X Layer at the fork block, then the sandbox now",
    ...e.untouched.flatMap((row) => [read(row, at, r.reference), read(row, "", r.sandbox)]),
    "# c. changed by recorded sandbox actions: X Layer at the fork block, then the sandbox now",
    ...e.explained.flatMap((row) => [read(row, at, r.reference), read(row, "", r.sandbox)]),
  ]
}

export function intattoCommands(r: Rpcs, e: IntattoEvidence): string[] {
  return [
    e.comparison === "artifacts"
      ? "# compare with contracts/out/<Contract>.sol/<Contract>.json deployedBytecode after zeroing its immutableReferences"
      : "# compare with the mainnet deployment's code after zeroing the immutable ranges on both sides",
    ...e.rows.flatMap((row) => [
      `cast code ${row.address} --rpc-url ${q(r.sandbox)}  # ${row.label} (${row.contract})`,
      ...(row.referenceAddress ? [`cast code ${row.referenceAddress} --rpc-url ${q(r.reference)}`] : []),
    ]),
  ]
}
