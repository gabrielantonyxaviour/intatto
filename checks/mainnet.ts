/**
 * Intatto on X Layer mainnet.
 *   --deploy  every contract in deployments/xlayer-mainnet.json has runtime code equal to the forge build
 *             (immutable slots masked), and the vault and gap reserve hold USDG.
 *   --live    the demo wallet has an NVDAx-backed USDG position, the keeper's last price post is within its
 *             liveness limit, the public credit API's answer for the demo wallet equals direct mainnet reads,
 *             and a real OKX AI call to the credit service was recorded.
 * Run: npx tsx checks/mainnet.ts --deploy | --live
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Address, Hex } from "viem"
import { marketLensAbi, priceRelayAdapterAbi } from "@intatto/config/abi"
import { parseDeployment } from "@intatto/config/deployments"
import { fail, pass, xlayerClient } from "./lib/rpc.ts"

const REPO = join(import.meta.dirname, "..")
const FILE = join(REPO, "deployments", "xlayer-mainnet.json")
const DEMO = (process.env.CLOSE_GUARD_DEMO_ADDRESS ?? "0x7F23b131F7312bd0f63EF79974E215Dc3E12a415") as Address
const PUBLIC_URL = process.env.PUBLIC_URL ?? "https://intatto.larinova.com"
const mode = process.argv.includes("--live") ? "live" : "deploy"

if (!existsSync(FILE)) fail("deployments/xlayer-mainnet.json does not exist: Intatto is not deployed on mainnet yet")
const d = parseDeployment(JSON.parse(readFileSync(FILE, "utf8")))
if (d.chainId !== 196) fail(`deployment chain id ${d.chainId}, expected 196`)
const client = xlayerClient()
const m = d.markets[0]

type Artifact = { deployedBytecode: { object: Hex; immutableReferences?: Record<string, { start: number; length: number }[]> } }

/** Runtime code with every immutable reference zeroed, so deployed code compares with the build output. */
function masked(code: Hex, art: Artifact): string {
  const bytes = code.slice(2)
  const chars = bytes.split("")
  for (const refs of Object.values(art.deployedBytecode.immutableReferences ?? {})) {
    for (const { start, length } of refs) for (let i = start * 2; i < (start + length) * 2; i++) chars[i] = "0"
  }
  return chars.join("")
}

if (mode === "deploy") {
  const contracts: [string, string][] = [
    ["LendingVault", d.vault], ["GapReserve", d.gapReserve], ["InterestRateModel", d.interestRateModel],
    ["SessionRiskController", d.sessionRisk], ["DepthCapRegistry", d.depthCaps], ["BoundedLiquidator", d.liquidator],
    ["MarketLens", d.lens], ["CollateralMarket", m.market], ["PriceRelayAdapter", m.priceRelay], ["CorporateActionGuard", m.corporateActionGuard],
  ]
  for (const [name, address] of contracts) {
    const art = JSON.parse(readFileSync(join(REPO, "contracts", "out", `${name}.sol`, `${name}.json`), "utf8")) as Artifact
    const code = await client.getCode({ address: address as Address })
    if (!code || code === "0x") fail(`${name} ${address} has no code on mainnet`)
    if (masked(code, art) !== masked(art.deployedBytecode.object, art)) fail(`${name} ${address} runtime code differs from the build output`)
    pass(`${name} ${address}: runtime code equals the build output (${(code.length - 2) / 2} bytes)`)
  }
  const v = (await client.readContract({ address: d.lens as Address, abi: marketLensAbi, functionName: "vault", args: [m.market as Address] })) as { totalAssets: bigint; reserveBalance: bigint }
  if (v.totalAssets === 0n) fail("the vault holds no USDG")
  if (v.reserveBalance === 0n) fail("the gap reserve holds no USDG")
  pass(`vault assets ${Number(v.totalAssets) / 1e6} USDG, gap reserve ${Number(v.reserveBalance) / 1e6} USDG`)
} else {
  const a = (await client.readContract({ address: d.lens as Address, abi: marketLensAbi, functionName: "account", args: [m.market as Address, DEMO] })) as { shares: bigint; debt: bigint; ltvBps: bigint }
  if (a.shares === 0n || a.debt === 0n) fail(`demo wallet ${DEMO} has no open position (shares ${a.shares}, debt ${a.debt})`)
  pass(`demo wallet ${DEMO}: ${Number(a.shares) / 1e18} wNVDAx collateral, ${Number(a.debt) / 1e6} USDG debt, LTV ${Number(a.ltvBps) / 100}%`)

  const [, fetchedAt] = (await client.readContract({ address: m.priceRelay as Address, abi: priceRelayAdapterAbi, functionName: "latestPrice" })) as [bigint, bigint]
  const liveness = (await client.readContract({ address: m.priceRelay as Address, abi: priceRelayAdapterAbi, functionName: "priceLiveness" })) as bigint
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (now - fetchedAt > liveness) fail(`keeper's last price post is ${now - fetchedAt}s old (limit ${liveness}s)`)
  pass(`keeper's last price post is ${now - fetchedAt}s old (limit ${liveness}s)`)

  const res = await fetch(`${PUBLIC_URL}/api/credit?wallet=${DEMO}&market=NVDAx`)
  const body = (await res.json()) as { block?: number; position?: { debtUsdg: string; collateralWrapperShares: string } }
  if (!res.ok || !body.block || !body.position) fail(`public credit API answered ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  const at = (await client.readContract({ address: d.lens as Address, abi: marketLensAbi, functionName: "account", args: [m.market as Address, DEMO], blockNumber: BigInt(body.block!) })) as { shares: bigint; debt: bigint }
  const apiDebt = Math.round(Number(body.position!.debtUsdg) * 1e6)
  const apiShares = Number(body.position!.collateralWrapperShares)
  if (Math.abs(apiDebt - Number(at.debt)) > 1) fail(`API debt ${body.position!.debtUsdg} differs from the chain (${Number(at.debt) / 1e6}) at block ${body.block}`)
  if (Math.abs(apiShares - Number(at.shares) / 1e18) > 1e-12) fail(`API collateral ${apiShares} differs from the chain at block ${body.block}`)
  pass(`public credit API matches mainnet reads for the demo wallet at block ${body.block}`)

  const receipts = await fetch(`${PUBLIC_URL}/api/credit/receipts?source=okx-ai`).then((r) => (r.ok ? (r.json() as Promise<{ calls?: number }>) : { calls: 0 }), () => ({ calls: 0 }))
  if (!receipts.calls) fail("no call from an OKX AI agent to the credit service has been recorded yet (listing not live or not called)")
  pass(`${receipts.calls} OKX AI agent call(s) recorded`)
}
