/**
 * The hosted sandbox, end to end on the local server (same router and session service as the Worker, one anvil
 * per session from the snapshot):
 *   npx tsx checks/sandbox.ts        session → funded burner → position through the PUBLIC rpc → Saturday refuses
 *                                    a further borrow (SessionLimit) → repay → the ledger holds every admin call
 *                                    → the synthetic gap also liquidates the forked demo borrower
 *   npx tsx checks/sandbox.ts --rpc  the public RPC refuses every fork-control and node-signing method (-32601)
 */
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  maxUint256,
  type Address,
  type Chain,
  type Hex,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { xLayer } from "viem/chains"
import { collateralMarketAbi, sessionRiskControllerAbi } from "@intatto/config/abi"
import { SANDBOX_CHAIN_ID, TICKERS, XLAYER, FORK_FUNDING_HOLDER } from "@intatto/config/xlayer"
import { sandboxSessionSchema } from "../web/lib/chain/sandbox-session.ts"
import { buildSnapshot, DEFAULT_SNAPSHOT_DIR } from "../services/sandbox/scripts/build-snapshot.ts"
import { startLocalSandbox } from "../services/sandbox/src/local.ts"
import { SCENARIO_BORROWER } from "../services/sandbox/src/session.ts"
import type { LedgerEntry } from "../services/sandbox/src/types.ts"
import { fail, pass } from "./lib/rpc.ts"

const rpcMode = process.argv.includes("--rpc")
const CHAIN_ID_HEX = `0x${SANDBOX_CHAIN_ID.toString(16)}`

if (!existsSync(join(DEFAULT_SNAPSHOT_DIR, "state.json")) || !existsSync(join(DEFAULT_SNAPSHOT_DIR, "meta.json"))) {
  const m = await buildSnapshot().catch((e) => fail(`snapshot build failed: ${e instanceof Error ? e.message : e}`))
  pass(`built the snapshot: fork block ${m.forkBlock}, ${(m.bytes / 1e6).toFixed(2)} MB state`)
}

const sandbox = await startLocalSandbox().catch((e) => fail(`local sandbox did not start: ${e instanceof Error ? e.message : e}`))
const api = sandbox.url

async function call<T = Record<string, unknown>>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as T }
}

async function rpc(url: string, payload: unknown): Promise<any> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
  return res.json()
}

type Admin = { entries: LedgerEntry[]; chain: { session: string; chainTime: number } | null }

try {
  const created = await call("POST", "/session")
  if (created.status !== 201) fail(`POST /session returned ${created.status}: ${JSON.stringify(created.body)}`)
  const stored = sandboxSessionSchema.safeParse(created.body)
  if (!stored.success) fail(`POST /session is not the web app's SandboxSession shape: ${stored.error.issues[0].path.join(".")} ${stored.error.issues[0].message}`)
  const session = stored.data
  const burner = privateKeyToAccount(session.burnerKey)
  if (burner.address !== created.body.burnerAddress) fail("burnerAddress does not match burnerKey")
  if (session.chainId !== SANDBOX_CHAIN_ID) fail(`chainId ${session.chainId}, expected ${SANDBOX_CHAIN_ID}`)
  pass(`POST /session → ${session.sessionId}: rpc ${session.rpcUrl}, fork block ${session.forkBlock}, burner ${burner.address}`)

  if (rpcMode) await rpcPolicy(session.rpcUrl, burner.address, session.forkBlock)
  else await journey(session, burner, created.body.entries as LedgerEntry[])
} catch (e) {
  fail(e instanceof Error ? e.message.split("\n").slice(0, 4).join(" ") : String(e))
} finally {
  await sandbox.stop()
}
process.exit(0)

async function journey(session: { sessionId: string; rpcUrl: string; deployment: any }, burner: ReturnType<typeof privateKeyToAccount>, startEntries: LedgerEntry[]) {
  const d = session.deployment
  const nvda = d.markets.find((m: { symbol: string }) => m.symbol === "NVDAx")
  const market = nvda.market as Address
  const chain = { ...xLayer, id: SANDBOX_CHAIN_ID, rpcUrls: { default: { http: [session.rpcUrl] } } } as Chain
  const client = createPublicClient({ chain, transport: http(session.rpcUrl, { timeout: 60_000 }) })
  const wallet = createWalletClient({ account: burner, chain, transport: http(session.rpcUrl, { timeout: 60_000 }) })
  const admin: Admin[] = [{ entries: startEntries, chain: null }]

  const balance = (token: Address) => client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [burner.address] })
  const [nvdax, usdg, spyx, okb] = await Promise.all([balance(TICKERS.NVDAx.token), balance(XLAYER.usdg), balance(TICKERS.SPYx.token), client.getBalance({ address: burner.address })])
  if (nvdax === 0n || usdg === 0n || spyx === 0n || okb === 0n) fail(`burner not funded (NVDAx ${nvdax}, USDG ${usdg}, SPYx ${spyx}, OKB ${okb})`)
  pass(`burner funded, read through the public RPC: ${Number(nvdax) / 1e18} NVDAx, ${Number(spyx) / 1e18} SPYx, ${Number(usdg) / 1e6} USDG, ${Number(okb) / 1e18} OKB`)

  const maxLtv = () => client.readContract({ address: d.sessionRisk, abi: sessionRiskControllerAbi, functionName: "maxLtvBps" })
  if ((await maxLtv()) < 4_600n) {
    const w = await call<Admin>("POST", `/session/${session.sessionId}/warp`, { target: "monday" })
    if (w.status !== 200 || w.body.chain?.session !== "OPEN") fail(`warp monday: ${w.status} ${JSON.stringify(w.body).slice(0, 300)}`)
    admin.push(w.body)
    pass(`the session started outside regular hours: warp {target:"monday"} → session OPEN, max LTV ${Number(await maxLtv()) / 100}%`)
  }

  const send = async (label: string, address: Address, abi: any, functionName: string, args: unknown[]) => {
    const hash: Hex = await wallet.writeContract({ address, abi, functionName, args } as never)
    const receipt = await client.waitForTransactionReceipt({ hash, pollingInterval: 250 })
    if (receipt.status !== "success") fail(`${label} reverted (${hash})`)
    return hash
  }
  await send("approve NVDAx", nvda.token, erc20Abi, "approve", [market, maxUint256])
  await send("addCollateral", market, collateralMarketAbi, "addCollateral", [5n * 10n ** 18n])
  const [shares] = await client.readContract({ address: market, abi: collateralMarketAbi, functionName: "positionOf", args: [burner.address] })
  const value = await client.readContract({ address: market, abi: collateralMarketAbi, functionName: "valueOf", args: [shares] })
  const borrow = (value * 4_500n) / 10_000n
  const borrowHash = await send("borrow", market, collateralMarketAbi, "borrow", [borrow])
  pass(`position opened through the public RPC (burner-signed eth_sendRawTransaction): 5 NVDAx worth ${Number(value) / 1e6} USDG, borrowed ${Number(borrow) / 1e6} USDG at 45% LTV (${borrowHash.slice(0, 10)}…)`)

  const sat = await call<Admin>("POST", `/session/${session.sessionId}/warp`, { target: "saturday" })
  if (sat.status !== 200 || sat.body.chain?.session !== "CLOSED") fail(`warp saturday: ${sat.status} ${JSON.stringify(sat.body).slice(0, 300)}`)
  admin.push(sat.body)
  const closedLtv = await maxLtv()
  try {
    await client.simulateContract({ account: burner.address, address: market, abi: collateralMarketAbi, functionName: "borrow", args: [10n ** 6n] })
    fail("a further borrow on Saturday simulated successfully; expected SessionLimit")
  } catch (e) {
    const reverted = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null
    const name = reverted instanceof ContractFunctionRevertedError ? reverted.data?.errorName : undefined
    if (name !== "SessionLimit") fail(`Saturday borrow reverted with ${name ?? (e instanceof Error ? e.message.split("\n")[0] : e)}, expected SessionLimit`)
    const [ltvAfter, limit] = (reverted as ContractFunctionRevertedError).data!.args as [bigint, bigint]
    pass(`warp {target:"saturday"} → session CLOSED (max LTV ${Number(closedLtv) / 100}%); eth_call borrow of 1 USDG reverts SessionLimit(${Number(ltvAfter) / 100}%, ${Number(limit) / 100}%)`)
  }

  await send("approve USDG", XLAYER.usdg, erc20Abi, "approve", [market, maxUint256])
  const repayHash = await send("repay", market, collateralMarketAbi, "repay", [maxUint256])
  const debt = await client.readContract({ address: market, abi: collateralMarketAbi, functionName: "debtOf", args: [burner.address] })
  if (debt !== 0n) fail(`debt after full repay is ${debt}`)
  pass(`repay through the public RPC while CLOSED succeeded; debt now 0 (${repayHash.slice(0, 10)}…)`)

  const ledger = await call<{ entries: LedgerEntry[] }>("GET", `/session/${session.sessionId}/ledger`)
  if (ledger.status !== 200) fail(`GET ledger returned ${ledger.status}`)
  const entries = ledger.body.entries
  const key = (e: LedgerEntry) => `${e.at}|${e.kind}|${e.summary}`
  const stored = new Set(entries.map(key))
  for (const [i, a] of admin.entries()) {
    if (a.entries.length === 0) fail(`admin call #${i} produced no ledger entry`)
    for (const e of a.entries) {
      if (!stored.has(key(e))) fail(`ledger is missing "${e.summary}"`)
      if (!(e.chainTime > 0)) fail(`ledger entry "${e.summary}" has no chain time`)
    }
  }
  const funded = entries.filter((e) => e.kind === "fund" && (e.detail as { to?: string } | undefined)?.to === burner.address)
  for (const sym of ["OKB", "NVDAx", "SPYx", "USDG"]) if (!funded.some((e) => e.summary.includes(sym))) fail(`ledger has no ${sym} funding entry for the burner`)
  const warps = entries.filter((e) => e.kind === "warp")
  if (!warps.some((e) => e.summary.includes("Saturday"))) fail("ledger has no Saturday warp")
  const keeper = entries.filter((e) => e.kind === "keeper")
  if (keeper.filter((e) => e.summary.includes("session")).length < admin.length) fail("ledger is missing a keeper session post for an admin call")
  if (!keeper.some((e) => e.summary.includes("SPYx"))) fail("ledger has no SPYx keeper post")
  if (!entries.some((e) => (e.detail as { from?: string } | undefined)?.from === "snapshot" && e.kind === "deploy")) fail("ledger does not open with the snapshot's deploy entry")
  pass(`GET ledger: ${entries.length} entries — ${funded.length} burner funding, ${warps.length} warps, ${keeper.length} keeper posts, each admin call's entries present with chain times`)

  const info = await call("GET", `/session/${session.sessionId}`)
  if (info.status !== 200 || info.body.status !== "active" || (info.body.chain as { session?: string })?.session !== "CLOSED") fail(`GET /session/:id: ${JSON.stringify(info.body).slice(0, 300)}`)
  pass(`GET /session/:id → active, chain session CLOSED, expires after ${info.body.expiresAfterIdleMinutes} idle minutes`)

  // A mainnet borrower who is neither the session burner nor the scenario borrower. 36% LTV at the fork;
  // the 45% synthetic gap pushes that over the 65% liquidation threshold.
  const demo = "0x7F23b131F7312bd0f63EF79974E215Dc3E12a415" as Address
  if (demo.toLowerCase() === burner.address.toLowerCase() || demo.toLowerCase() === SCENARIO_BORROWER.toLowerCase()) fail("the forked demo borrower is not a third address")
  const debtOf = (who: Address) => client.readContract({ address: market, abi: collateralMarketAbi, functionName: "debtOf", args: [who] })
  const before = await debtOf(demo)
  if (before === 0n) fail(`forked demo borrower ${demo} has no NVDAx debt on this snapshot`)
  const gap = await call<Admin>("POST", `/session/${session.sessionId}/scenario`, { name: "synthetic-gap" })
  if (gap.status !== 200) fail(`synthetic gap: ${gap.status} ${JSON.stringify(gap.body).slice(0, 400)}`)
  const after = await debtOf(demo)
  const watch = gap.body.entries.find((e) => e.summary.startsWith("liquidation watch:"))
  const liquidated = ((watch?.detail as { liquidated?: string[]; checked?: number } | undefined)?.liquidated ?? []).map((a) => a.toLowerCase())
  const checked = (watch?.detail as { checked?: number } | undefined)?.checked
  if (!(after < before) || !liquidated.includes(demo.toLowerCase())) {
    fail(`forked borrower ${demo} was not liquidated (debt ${before} → ${after}; watch: ${watch?.summary ?? "missing"})`)
  }
  if (typeof checked !== "number" || checked < 2) fail(`liquidation watch checked ${checked}, expected the demo borrower and the scenario borrower`)
  pass(`synthetic gap liquidated forked borrower ${demo} (debt ${Number(before) / 1e6} → ${Number(after) / 1e6} USDG); watch checked ${checked}`)
}

async function rpcPolicy(rpcUrl: string, burner: Address, forkBlock: number) {
  const before = await rpc(rpcUrl, { jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [burner, "latest"] })
  const refused: [string, unknown[]][] = [
    ["anvil_setBalance", [burner, "0x3635c9adc5dea00000"]],
    ["anvil_impersonateAccount", [FORK_FUNDING_HOLDER]],
    ["evm_increaseTime", [86_400]],
    ["evm_mine", []],
    ["evm_snapshot", []],
    ["hardhat_setBalance", [burner, "0x3635c9adc5dea00000"]],
    ["debug_traceTransaction", [`0x${"11".repeat(32)}`]],
    ["eth_sendTransaction", [{ from: FORK_FUNDING_HOLDER, to: burner, value: "0x1" }]],
    ["eth_sign", [burner, "0xdeadbeef"]],
    ["personal_sign", ["0xdeadbeef", burner]],
  ]
  for (const [method, params] of refused) {
    const res = await rpc(rpcUrl, { jsonrpc: "2.0", id: method, method, params })
    if (res?.error?.code !== -32601 || res.id !== method) fail(`${method} was not refused with -32601: ${JSON.stringify(res).slice(0, 200)}`)
  }
  pass(`refused with -32601: ${refused.map(([m]) => m).join(", ")}`)

  const after = await rpc(rpcUrl, { jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [burner, "latest"] })
  if (after.result !== before.result) fail(`a refused call changed the burner's balance (${before.result} → ${after.result})`)
  pass("refused calls had no effect on the fork (burner balance unchanged)")

  const chainId = await rpc(rpcUrl, { jsonrpc: "2.0", id: 7, method: "eth_chainId", params: [] })
  // 1960196 is 0x1de904 (the brief's "0x1dea04" is a typo: that is 1960452).
  if (chainId.result !== CHAIN_ID_HEX) fail(`eth_chainId returned ${JSON.stringify(chainId)}, expected ${CHAIN_ID_HEX}`)
  const block = await rpc(rpcUrl, { jsonrpc: "2.0", id: 8, method: "eth_blockNumber", params: [] })
  if (!(Number(block.result) > forkBlock)) fail(`eth_blockNumber returned ${JSON.stringify(block)}`)
  pass(`eth_chainId = ${CHAIN_ID_HEX} (${SANDBOX_CHAIN_ID}); eth_blockNumber = ${Number(block.result)} (fork block ${forkBlock})`)

  const batch = await rpc(rpcUrl, [
    { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
    { jsonrpc: "2.0", id: 2, method: "anvil_setBalance", params: [burner, "0x1"] },
    { jsonrpc: "2.0", id: 3, method: "eth_blockNumber", params: [] },
    { jsonrpc: "2.0", id: 1, method: "evm_mine", params: [] },
  ])
  if (!Array.isArray(batch) || batch.length !== 4) fail(`batch returned ${JSON.stringify(batch).slice(0, 200)}`)
  const ok = batch[0].result === CHAIN_ID_HEX && batch[1].error?.code === -32601 && Number(batch[2].result) > forkBlock && batch[3].error?.code === -32601
  if (!ok || batch.map((r: { id: number }) => r.id).join() !== "1,2,3,1") fail(`mixed batch answered wrongly: ${JSON.stringify(batch).slice(0, 400)}`)
  pass("mixed batch: allowed calls answered, anvil_/evm_ calls refused with -32601, order and ids preserved")

  const unknown = await fetch(`${api}/rpc/${"A".repeat(22)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) })
  const bad = await fetch(`${api}/rpc/not!valid`, { method: "POST", body: "{}" })
  const unknownBody = (await unknown.json()) as { code?: string }
  if (unknown.status !== 404 || unknownBody.code !== "session_not_found" || bad.status !== 400) fail(`unknown/invalid session ids answered ${unknown.status}/${bad.status}`)
  pass("an unknown session id is 404 session_not_found (no chain is started for it); a malformed id is 400")
}
