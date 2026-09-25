/**
 * The sandbox snapshot's metadata (container/snapshot/meta.json), written by scripts/build-snapshot.ts and read
 * by the Worker, the local server and the container entrypoint. Portable: zod only.
 */
import { z } from "zod"
import { deploymentSchema } from "@intatto/config/deployments"
import { SANDBOX_CHAIN_ID } from "@intatto/config/xlayer"

export const snapshotLedgerEntrySchema = z.object({
  kind: z.enum(["fund", "warp", "keeper", "actor", "scenario", "reset", "deploy", "note"]),
  summary: z.string(),
  detail: z.record(z.unknown()).optional(),
  txHash: z.string().optional(),
  chainTime: z.number().int(),
  at: z.string(),
})

export const snapshotMetaSchema = z.object({
  /** X Layer mainnet block the snapshot forks from; the container passes it to anvil --fork-block-number. */
  forkBlock: z.number().int().positive(),
  chainId: z.literal(SANDBOX_CHAIN_ID),
  createdAt: z.string(),
  /** Latest block and chain time inside the dumped state. */
  snapshotBlock: z.number().int().positive(),
  snapshotChainTime: z.number().int().positive(),
  /** sha256 of state.json, so a container can prove which state it loaded. */
  stateSha256: z.string().regex(/^[0-9a-f]{64}$/),
  deployment: deploymentSchema,
  /** The snapshot's own divergence from mainnet: deploy, funding, seeding and the USDG staleness note. */
  ledger: z.array(snapshotLedgerEntrySchema),
})

export type SnapshotMeta = z.infer<typeof snapshotMetaSchema>

export function parseSnapshotMeta(input: unknown): SnapshotMeta {
  return snapshotMetaSchema.parse(input)
}
