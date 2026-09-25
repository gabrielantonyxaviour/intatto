/**
 * Builds the sandbox snapshot (Node, build time) and dumps anvil's state. Two bases:
 * - default: forks X Layer at the pinned block with the shared harness and deploys Intatto fresh (NVDAx + SPYx);
 * - `--deployment <file>` (deployments/xlayer-mainnet.json): forks a block after the mainnet deployment and uses
 *   the LIVE mainnet contracts at their mainnet addresses, deploying only the SPYx market on top (mainnet-fork.ts).
 * Both seed the lender (50,000 USDG) and the gap reserve (+100 USDG) from the real holder and post a first keeper
 * tick for NVDAx and SPYx.
 *
 * Writes <out>/state.json (anvil --load-state input) and <out>/meta.json (forkBlock, chainId, base, deployment and
 * the snapshot's own ledger). Default <out> is services/sandbox/container/snapshot.
 *
 * Run: npx tsx services/sandbox/scripts/build-snapshot.ts [--out <dir>] [--deployment <file>]
 */
import { createHash } from "node:crypto"
import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { gunzipSync } from "node:zlib"
import type { Hex } from "viem"
import { SANDBOX_CHAIN_ID } from "@intatto/config/xlayer"
import { startForkHarness } from "../../../checks/fork/harness.ts"
import { poolImpliedQuote } from "../../../checks/fork/lib/actors.ts"
import { parseSnapshotMeta, type SnapshotMeta } from "../src/snapshot.ts"
import { startMainnetFork } from "./mainnet-fork.ts"

export const DEFAULT_SNAPSHOT_DIR = resolve(import.meta.dirname, "..", "container", "snapshot")

/** anvil_dumpState returns hex-encoded gzip of the JSON --load-state reads. */
export function decodeDump(hex: Hex): string {
  const bytes = Buffer.from(hex.slice(2), "hex")
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b
  return (isGzip ? gunzipSync(bytes) : bytes).toString("utf8")
}

/** Local sandboxes and checks may be loading the snapshot while it is rebuilt: never expose a half-written file. */
function writeAtomic(path: string, content: string) {
  writeFileSync(`${path}.tmp`, content)
  renameSync(`${path}.tmp`, path)
}

async function startBase(deploymentFile?: string) {
  if (deploymentFile) {
    const m = await startMainnetFork(deploymentFile)
    return { ...m, base: { kind: "mainnet" as const, ...m.mainnet } }
  }
  // No harness burner: every sandbox session funds its own burner after the snapshot loads.
  const h = await startForkHarness({ spyx: true, burner: { okb: 0n, nvdax: 0n, usdg: 0n } })
  return { ...h, base: { kind: "fresh-deploy" as const } }
}

export async function buildSnapshot(opts: { outDir?: string; deploymentFile?: string } = {}): Promise<SnapshotMeta & { statePath: string; bytes: number }> {
  const outDir = resolve(opts.outDir ?? DEFAULT_SNAPSHOT_DIR)
  const h = await startBase(opts.deploymentFile)
  try {
    const { accepted } = await h.ctx.keeper.price(await poolImpliedQuote(h.fork, "SPYx"), "SPYx")
    if (!accepted) throw new Error("the SPYx relay rejected the snapshot's first price post")

    const block = await h.fork.client.getBlock({ blockTag: "latest" })
    const state = decodeDump(await h.fork.request<Hex>("anvil_dumpState"))
    JSON.parse(state) // must be valid JSON for anvil --load-state

    mkdirSync(outDir, { recursive: true })
    const statePath = join(outDir, "state.json")
    writeAtomic(statePath, state)
    const meta = parseSnapshotMeta({
      forkBlock: h.anvil.forkBlock,
      chainId: SANDBOX_CHAIN_ID,
      createdAt: new Date().toISOString(),
      snapshotBlock: Number(block.number),
      snapshotChainTime: Number(block.timestamp),
      stateSha256: createHash("sha256").update(state).digest("hex"),
      base: h.base,
      deployment: h.deployment,
      ledger: h.fork.ledger.entries,
    })
    writeAtomic(join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`)
    return { ...meta, statePath, bytes: Buffer.byteLength(state) }
  } finally {
    await h.anvil.stop()
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildSnapshot({ outDir: arg("--out"), deploymentFile: arg("--deployment") }).then(
    (m) => {
      process.stdout.write(
        `snapshot: fork block ${m.forkBlock}, snapshot block ${m.snapshotBlock}, ${(m.bytes / 1e6).toFixed(2)} MB state, ` +
          `${m.ledger.length} ledger entries, base ${m.base.kind}, markets ${m.deployment.markets.map((x) => x.symbol).join("+")}\n  ${m.statePath}\n`,
      )
      process.exit(0)
    },
    (e: unknown) => {
      process.stderr.write(`snapshot build failed: ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(1)
    },
  )
}
