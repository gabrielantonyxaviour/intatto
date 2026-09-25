/**
 * Keeper accept check.
 *   npx tsx checks/keeper.ts --unit   issuer adapter over recorded fixtures (closed, halted, pending action …),
 *                                     adapter cache/backoff, depth-cap math, the SQLite store
 *   npx tsx checks/keeper.ts          one keeper cycle (plus two follow-ups) on the shared fork harness,
 *                                     as the deployment's keeper, asserted onchain
 */
import { readFileSync } from "node:fs"
import { createPublicClient, createWalletClient, decodeEventLog, formatUnits, http, type Address, type Chain, type Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { xLayer } from "viem/chains"
import { marketFor } from "@intatto/config/deployments"
import { sessionIndex } from "@intatto/config/session"
import { corporateActionGuardAbi, depthCapRegistryAbi, priceRelayAdapterAbi, sessionRiskControllerAbi } from "@intatto/config/abi"
import { fail, pass } from "./lib/rpc.ts"
import { startForkHarness, DEV } from "./fork/harness.ts"
import { poolImpliedQuote } from "./fork/lib/actors.ts"
import { openPosition } from "./fork/lib/scenarios.ts"
import { runCycle, type CycleResult } from "../services/keeper/src/cycle.ts"
import { RecordedIssuer, XStocksIssuer, type IssuerFixture } from "../services/keeper/src/issuer.ts"
import { SqlKeeperStore } from "../services/keeper/src/store.ts"
import type { KeeperAction } from "../services/keeper/src/types.ts"
import { loadFixture, MIGRATION, nodeSql, runUnit } from "../services/keeper/test/unit.ts"

if (process.argv.includes("--unit")) {
  await runUnit({ pass, fail })
  process.exit(0)
}

const POSTS: KeeperAction["kind"][] = ["session", "price", "price-rejected", "cap", "action", "liquidation"]
const kinds = (c: CycleResult) => c.actions.map((a) => a.kind).join(", ") || "nothing"
const only = (c: CycleResult, kind: KeeperAction["kind"]) => {
  const found = c.actions.filter((a) => a.kind === kind)
  if (found.length !== 1 || !found[0].txHash) fail(`expected exactly one ${kind} post with a tx hash, cycle did: ${kinds(c)}`)
  return found[0] as KeeperAction & { txHash: Hex }
}

const live = await new XStocksIssuer().quote("NVDAx").catch((e: unknown) => fail(`live issuer read failed: ${e instanceof Error ? e.message : e}`))
if (live === null || live <= 0n) fail("live issuer NVDAx price-data returned no quote")
pass(`live issuer read: api.xstocks.fi NVDAx price-data quote $${formatUnits(live, 18)} parsed`)

const h = await startForkHarness().catch((e: unknown) => fail(`harness did not start: ${e instanceof Error ? e.message : e}`))
try {
  const { fork, deployment: d, anvil } = h
  const nvda = marketFor(d)
  const account = privateKeyToAccount(DEV.keeper.key)
  if (account.address.toLowerCase() !== d.keeper.toLowerCase()) fail(`dev keeper ${account.address} is not the deployment keeper ${d.keeper}`)
  const chain = { ...xLayer, id: anvil.chainId, rpcUrls: { default: { http: [anvil.rpcUrl] } } } as Chain
  const publicClient = createPublicClient({ chain, transport: http(anvil.rpcUrl, { timeout: 120_000 }) })
  const walletClient = createWalletClient({ account, chain, transport: http(anvil.rpcUrl, { timeout: 120_000 }) })
  pass(`fork at block ${anvil.forkBlock}; keeper signs as ${account.address} (anvil dev key, the deployment's keeper)`)

  const borrower = privateKeyToAccount(generatePrivateKey()).address
  await openPosition(h.ctx, borrower, 2n * 10n ** 18n, 2_000)

  const store = new SqlKeeperStore(nodeSql())
  store.migrate(readFileSync(MIGRATION, "utf8"))

  // The fixture quote is the pool-implied one, so the relay's TWAP band admits it.
  const quote = await poolImpliedQuote(fork)
  const withQuote = (f: IssuerFixture) => new RecordedIssuer({ NVDAx: { ...f.responses, priceData: { quote: Number(formatUnits(quote, 18)) } } })
  const cycleAt = (issuer: RecordedIssuer, now: number) =>
    runCycle({ publicClient, walletClient, deployment: d, issuer, log: (a) => void store.append(a), now: () => now, state: store })

  // Every transaction of a cycle lands at the cycle's time: blocks keep one timestamp until the next warp.
  await fork.request("anvil_setBlockTimestampInterval", [0])
  const T = (await fork.chainTime()) + 11 * 60
  await fork.warpTo(T, "keeper check: 11 minutes on, so the session (>10 min) and price (>5 min) posts are due")
  const c1 = await cycleAt(withQuote(loadFixture("nvdax-extended.json")), T)
  pass(`cycle 1 at ${c1.at} (recorded extended-period fixture, quote $${formatUnits(quote, 18)}): ${kinds(c1)}`)

  const session = only(c1, "session")
  const [posted, , postedAt] = await publicClient.readContract({ address: d.sessionRisk as Address, abi: sessionRiskControllerAbi, functionName: "lastPost" })
  if (Number(posted) !== sessionIndex("EXTENDED") || Number(postedAt) !== T) fail(`session read back ${posted} posted at ${postedAt}, expected EXTENDED at ${T}`)
  pass(`session EXTENDED reads back: lastPost.postedAt ${postedAt} == cycle time (tx ${session.txHash})`)

  const price = only(c1, "price")
  const [stored, fetchedAt] = await publicClient.readContract({ address: nvda.priceRelay as Address, abi: priceRelayAdapterAbi, functionName: "latestPrice" })
  if (stored !== quote || price.data?.quoteE18 !== quote.toString() || Number(fetchedAt) !== T) fail(`latestPrice ${stored} @ ${fetchedAt}, posted ${price.data?.quoteE18} @ ${T}`)
  pass(`price posted and latestPrice equals it: $${formatUnits(stored, 18)} fetched at ${fetchedAt} (tx ${price.txHash})`)

  const cap = only(c1, "cap")
  const capReceipt = await publicClient.getTransactionReceipt({ hash: cap.txHash })
  const capEvents = capReceipt.logs.flatMap((l) => {
    try {
      const e = decodeEventLog({ abi: depthCapRegistryAbi, data: l.data, topics: l.topics })
      return e.eventName === "CapPosted" ? [e.args] : []
    } catch {
      return []
    }
  })
  const capOf = await publicClient.readContract({ address: d.depthCaps as Address, abi: depthCapRegistryAbi, functionName: "capOf", args: [nvda.market as Address] })
  const target = capEvents[0]?.targetCapUsdg ?? 0n
  if (capEvents.length !== 1 || target === 0n || target.toString() !== cap.data?.capUsdg || capOf === 0n) fail(`CapPosted ${capEvents.length}, target ${target}, capOf ${capOf}`)
  pass(`depth cap from QuoterV2: CapPosted target ${formatUnits(target, 6)} USDG, slice ${formatUnits(capEvents[0].sliceUsdg, 6)} USDG; capOf ${formatUnits(capOf, 6)} USDG`)
  if (c1.actions.some((a) => a.kind === "action")) fail("cycle 1 posted a corporate action, but the real fixture has none")

  const known = JSON.parse((await store.get("borrowers:NVDAx")) ?? "[]") as string[]
  if (!known.includes(borrower) || c1.actions.some((a) => a.kind === "liquidation")) fail(`liquidation scan: borrowers ${known.join(",")}`)
  pass(`liquidation scan found borrower ${borrower} in Borrowed logs up to block ${await store.get("cursor:NVDAx")}; healthy, nothing liquidated`)

  const pendingFx = loadFixture("nvdax-pending-multiplier.synthetic.json")
  await fork.warpTo(T + 60, "keeper check: one minute on, with the synthetic pending-multiplier fixture")
  const c2 = await cycleAt(withQuote(pendingFx), T + 60)
  const action = only(c2, "action")
  if (c2.actions.some((a) => a.kind !== "action")) fail(`cycle 2 should post only the action, did: ${kinds(c2)}`)
  const pending = await publicClient.readContract({ address: nvda.corporateActionGuard as Address, abi: corporateActionGuardAbi, functionName: "pendingAction" })
  if (!pending.active || Number(pending.activationAt) !== 1_791_198_000 || pending.expectedMultiplier !== 10_017011968010740000n) fail(`pendingAction ${JSON.stringify(pending, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`)
  pass(`cycle 2: pending action posted and reads back (activation ${new Date(1_791_198_000_000).toISOString()}, multiplier ${formatUnits(pending.expectedMultiplier, 18)}; tx ${action.txHash}); nothing else was due`)

  await fork.warpTo(T + 120, "keeper check: another minute, same pending fixture")
  const c3 = await cycleAt(withQuote(pendingFx), T + 120)
  if (c3.actions.length !== 0) fail(`cycle 3 should post nothing (action already posted, nothing due), did: ${kinds(c3)}`)
  pass("cycle 3: the same pending action is not posted twice; nothing else due")
  await fork.request("anvil_removeBlockTimestampInterval", [])

  const log = store.recent(500).reverse()
  const bad = log.filter((a) => a.kind === "skipped" || a.kind === "backoff" || a.kind === "price-rejected")
  if (bad.length) fail(`unexpected log entries: ${bad.map((a) => `${a.kind}: ${a.detail}`).join(" | ")}`)
  const sent = log.filter((a) => a.txHash)
  if (sent.length !== 4 || log.some((a) => POSTS.includes(a.kind) && !a.txHash)) fail(`expected 4 posts, each with a tx hash; log: ${log.map((a) => a.kind).join(", ")}`)
  if (new Set(sent.map((a) => a.txHash)).size !== sent.length) fail("two log entries share a tx hash")
  for (const a of sent) {
    const r = await publicClient.getTransactionReceipt({ hash: a.txHash! })
    if (r.status !== "success" || r.from.toLowerCase() !== d.keeper.toLowerCase()) fail(`${a.kind} tx ${a.txHash} status ${r.status} from ${r.from}`)
  }
  pass(`action log (SQLite, the Durable Object schema): ${sent.map((a) => a.kind).join(", ")}; one entry per post, each tx mined successfully from the keeper`)
} catch (e) {
  fail(e instanceof Error ? e.message : String(e))
} finally {
  await h.stop()
}
process.exit(0)
