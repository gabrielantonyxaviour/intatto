/** Check 1: the fork block and earlier blocks have the same hash on the sandbox and on X Layer. */
import { getBlock, type BlockInfo, type ProofClient } from "./rpc"

export const BLOCK_OFFSETS = [0n, 1n, 10n, 100n] as const

export type BlockRow = {
  number: bigint
  offset: bigint
  sandbox: BlockInfo | null
  reference: BlockInfo | null
  equal: boolean
}

export type BlocksEvidence = { rows: BlockRow[] }

export async function checkBlocks(sandbox: ProofClient, reference: ProofClient, forkBlock: bigint) {
  const numbers = BLOCK_OFFSETS.filter((o) => o <= forkBlock).map((o) => ({ offset: o, number: forkBlock - o }))
  const rows = await Promise.all(
    numbers.map(async ({ offset, number }): Promise<BlockRow> => {
      const [s, r] = await Promise.all([getBlock(sandbox, number), getBlock(reference, number)])
      return { number, offset, sandbox: s, reference: r, equal: !!s && !!r && s.hash === r.hash }
    }),
  )
  return { pass: rows.every((r) => r.equal), evidence: { rows } satisfies BlocksEvidence }
}
