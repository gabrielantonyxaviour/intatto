/**
 * The shared fork harness, end to end: pinned X Layer fork, deploy, burner funded from real holders,
 * a keeper session and price that read back onchain, and a named scenario (the weekend).
 * Run: npx tsx checks/fork/self-test.ts
 */
import type { Address } from "viem"
import { sessionFromIndex } from "@intatto/config/session"
import { fail, pass } from "../lib/rpc.ts"
import * as abi from "./lib/abis.ts"
import { weekend } from "./lib/scenarios.ts"
import { startForkHarness } from "./harness.ts"

const h = await startForkHarness().catch((e) => fail(`harness did not start: ${e instanceof Error ? e.message : e}`))
try {
  const { fork, deployment: d, env } = h
  const nvda = d.markets[0]
  pass(`fork of X Layer at block ${env.forkBlock}, chain ${env.chainId}, Intatto deployed (market ${nvda.market})`)

  for (const [name, address] of Object.entries({ vault: d.vault, market: nvda.market, relay: nvda.priceRelay, liquidator: d.liquidator })) {
    const code = await fork.client.getCode({ address: address as Address })
    if (!code || code === "0x") fail(`${name} has no code`)
  }
  pass("every deployed contract has code")

  const nvdax = await fork.read<bigint>(nvda.token as Address, abi.erc20, "balanceOf", [env.burnerAddress])
  const usdg = await fork.read<bigint>(d.usdg as Address, abi.erc20, "balanceOf", [env.burnerAddress])
  const okb = await fork.client.getBalance({ address: env.burnerAddress })
  if (nvdax === 0n || usdg === 0n || okb === 0n) fail(`burner has a zero balance (NVDAx ${nvdax}, USDG ${usdg}, OKB ${okb})`)
  pass(`burner ${env.burnerAddress} funded from real holders: ${Number(nvdax) / 1e18} NVDAx, ${Number(usdg) / 1e6} USDG`)

  const session = sessionFromIndex(Number(await fork.read<number>(d.sessionRisk as Address, abi.sessionRisk, "currentSession")))
  if (session === "UNKNOWN") fail("keeper session did not read back onchain")
  const [price, fetchedAt] = await fork.read<[bigint, bigint]>(nvda.priceRelay as Address, abi.priceRelay, "latestPrice")
  if (price === 0n) fail("keeper price did not read back onchain")
  pass(`keeper posts read back: session ${session}, NVDAx $${(Number(price) / 1e18).toFixed(3)} fetched at ${fetchedAt}`)

  await weekend(h.ctx)
  const after = sessionFromIndex(Number(await fork.read<number>(d.sessionRisk as Address, abi.sessionRisk, "currentSession")))
  if (after !== "CLOSED") fail(`weekend scenario left the session ${after}, expected CLOSED`)
  const maxLtv = await fork.read<bigint>(d.sessionRisk as Address, abi.sessionRisk, "maxLtvBps")
  pass(`named scenario "weekend": session CLOSED, max new-borrow LTV ${Number(maxLtv) / 100}%`)

  const kinds = new Set(fork.ledger.entries.map((e) => e.kind))
  for (const k of ["deploy", "fund", "keeper", "warp"]) if (!kinds.has(k as never)) fail(`ledger has no ${k} entry`)
  pass(`ledger recorded ${fork.ledger.entries.length} entries`)
} catch (e) {
  fail(e instanceof Error ? e.message : String(e))
} finally {
  await h.stop()
}
