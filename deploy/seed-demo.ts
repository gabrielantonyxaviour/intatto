/**
 * Mainnet demo position, with the vaulted keys (never printed):
 * the operator (keeper) makes sure a fresh session and price are posted, then the demo wallet lends its USDG
 * into the vault, deposits its NVDAx as collateral and borrows about 0.40 USDG within the session's limit.
 * Wallets touch only Intatto's contracts and the issuer's wrapper (through the market).
 * Usage: npx tsx deploy/seed-demo.ts deployments/xlayer-mainnet.json
 */
import { readFileSync } from "node:fs"
import { createPublicClient, createWalletClient, erc20Abi, fallback, http, maxUint256, type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { xLayer } from "viem/chains"
import { collateralMarketAbi, lendingVaultAbi, marketLensAbi, priceRelayAdapterAbi, sessionRiskControllerAbi } from "@intatto/config/abi"
import { parseDeployment } from "@intatto/config/deployments"
import { ISSUER_API, xlayerRpcUrls } from "@intatto/config/xlayer"
import { sessionFromIssuer, sessionIndex } from "@intatto/config/session"
import { calendarSession } from "../checks/fork/lib/clock.ts"

const d = parseDeployment(JSON.parse(readFileSync(process.argv[2] ?? "deployments/xlayer-mainnet.json", "utf8")))
const m = d.markets[0]
const transport = fallback(xlayerRpcUrls().map((u) => http(u, { timeout: 30_000 })))
const pub = createPublicClient({ chain: xLayer, transport })
const operator = privateKeyToAccount(process.env.CLOSE_GUARD_OPERATOR_PK as Hex)
const demo = privateKeyToAccount(process.env.CLOSE_GUARD_DEMO_PK as Hex)
const opWallet = createWalletClient({ chain: xLayer, transport, account: operator })
const demoWallet = createWalletClient({ chain: xLayer, transport, account: demo })
const say = (s: string) => process.stdout.write(`${s}\n`)

async function send(wallet: typeof opWallet, req: Parameters<typeof pub.simulateContract>[0], what: string) {
  const { request } = await pub.simulateContract({ ...req, account: wallet.account } as never)
  const hash = await wallet.writeContract(request as never)
  const r = await pub.waitForTransactionReceipt({ hash })
  if (r.status !== "success") throw new Error(`${what} reverted: ${hash}`)
  say(`ok ${what}: ${hash}`)
  return hash
}

async function issuer(path: string) {
  const res = await fetch(`${ISSUER_API}${path}`, { headers: { "user-agent": "Mozilla/5.0 (Intatto keeper)" } })
  if (!res.ok) throw new Error(`issuer ${path} → ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

if ((operator.address as string).toLowerCase() !== d.keeper.toLowerCase()) throw new Error("operator is not the deployment's keeper")

// 1. Keeper: fresh session and price.
const asset = (await issuer("/public/assets/NVDAx")) as { trading?: { currentPeriod?: string; isTradingHalted?: boolean }; isTradingHalted?: boolean }
const session = sessionFromIssuer(asset.trading?.currentPeriod, Boolean(asset.isTradingHalted || asset.trading?.isTradingHalted))
const now = Math.floor(Date.now() / 1000)
const cal = calendarSession(now)
const periodChangedAt = cal.session === session ? cal.periodChangedAt : now
await send(opWallet, { address: d.sessionRisk as Address, abi: sessionRiskControllerAbi, functionName: "postSession", args: [sessionIndex(session), BigInt(periodChangedAt)] } as never, `keeper posted session ${session}`)
const { quote } = (await issuer("/public/assets/NVDAx/price-data")) as { quote: number | null }
if (!quote) throw new Error("issuer returned no quote")
const quoteE18 = BigInt(Math.round(quote * 1e6)) * 10n ** 12n
const fetchedAt = BigInt(Math.floor(Date.now() / 1000) - 2)
const sim = await pub.simulateContract({ address: m.priceRelay as Address, abi: priceRelayAdapterAbi, functionName: "post", args: [quoteE18, fetchedAt], account: operator })
if (!sim.result) throw new Error(`the relay would reject quote $${quote} (check the TWAP band); not posting`)
await send(opWallet, { address: m.priceRelay as Address, abi: priceRelayAdapterAbi, functionName: "post", args: [quoteE18, fetchedAt] } as never, `keeper posted NVDAx quote $${quote}`)

// 2. Demo wallet lends its USDG.
const usdg = await pub.readContract({ address: d.usdg as Address, abi: erc20Abi, functionName: "balanceOf", args: [demo.address] })
if (usdg > 0n) {
  await send(demoWallet, { address: d.usdg as Address, abi: erc20Abi, functionName: "approve", args: [d.vault as Address, usdg] } as never, "demo approved USDG to the vault")
  await send(demoWallet, { address: d.vault as Address, abi: lendingVaultAbi, functionName: "deposit", args: [usdg, demo.address] } as never, `demo lent ${Number(usdg) / 1e6} USDG`)
}

// 3. Demo wallet deposits its NVDAx and borrows within the session limit.
const nvdax = await pub.readContract({ address: m.token as Address, abi: erc20Abi, functionName: "balanceOf", args: [demo.address] })
if (nvdax > 0n) {
  await send(demoWallet, { address: m.token as Address, abi: erc20Abi, functionName: "approve", args: [m.market as Address, maxUint256] } as never, "demo approved NVDAx to the market")
  await send(demoWallet, { address: m.market as Address, abi: collateralMarketAbi, functionName: "addCollateral", args: [nvdax] } as never, `demo deposited ${Number(nvdax) / 1e18} NVDAx`)
}
const acct = (await pub.readContract({ address: d.lens as Address, abi: marketLensAbi, functionName: "account", args: [m.market as Address, demo.address] })) as { borrowCapacity: bigint }
const target = 400_000n // 0.40 USDG
const borrow = (acct.borrowCapacity * 95n) / 100n < target ? (acct.borrowCapacity * 95n) / 100n : target
if (borrow === 0n) throw new Error("no borrowing capacity right now (session limit, guards or liquidity)")
await send(demoWallet, { address: m.market as Address, abi: collateralMarketAbi, functionName: "borrow", args: [borrow] } as never, `demo borrowed ${Number(borrow) / 1e6} USDG`)
say("demo position open")
