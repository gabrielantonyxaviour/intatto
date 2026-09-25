/**
 * Accept check for the credit and health API (blk_credit_api). Calls the route's GET in plain Node.
 *   npx tsx checks/credit-api.ts --mode sandbox                 fork, open a ~30% LTV position, match every field to direct reads
 *   npx tsx checks/credit-api.ts --mode paid --challenge-only   402 + PAYMENT-REQUIRED challenge only; pays and settles nothing
 */
import {
  BaseError, ContractFunctionRevertedError, createWalletClient, erc20Abi, formatUnits, getAddress, http, parseAbi, parseUnits,
  type Abi, type Address, type Chain,
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { xLayer } from "viem/chains"
import { createServer } from "node:http"
import { z } from "zod"
import {
  collateralMarketAbi, corporateActionGuardAbi, depthCapRegistryAbi, lendingVaultAbi, priceRelayAdapterAbi, sessionRiskControllerAbi,
} from "@intatto/config/abi"
import type { Deployment } from "@intatto/config/deployments"
import { sessionFromIndex } from "@intatto/config/session"
import { XLAYER } from "@intatto/config/xlayer"
import { GET } from "../web/app/api/credit/route.ts"
import { GET as HEALTH } from "../web/app/api/credit/health/route.ts"
import { startForkHarness } from "./fork/harness.ts"
import type { ForkChain } from "./fork/lib/chain.ts"
import { fail, pass } from "./lib/rpc.ts"

const API = "https://intatto.larinova.com/api/credit"
const MAX = 2n ** 256n - 1n
const wrapperAbi = parseAbi(["function convertToAssets(uint256) view returns (uint256)"])
const PRICE_SOURCE = "keeper relay of the xStocks issuer's indicative quote (trusted relayer, bounded onchain)"
const iso = (s: bigint) => (s === 0n ? null : new Date(Number(s) * 1000).toISOString())
const min = (...xs: bigint[]) => xs.reduce((a, b) => (a < b ? a : b))
const pos = (x: bigint) => (x > 0n ? x : 0n)

type Json = Record<string, unknown>
const get = (q: string) => GET(new Request(`${API}?${q}`))

/** Flattens to path → leaf so two reports compare field by field. */
function flatten(v: unknown, path = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) flatten(x, path ? `${path}.${k}` : k, out)
  else out[path] = v
  return out
}

async function expectError(res: Response, status: number, code: string, what: string) {
  const text = await res.text()
  if (res.status !== status) fail(`${what}: expected HTTP ${status}, got ${res.status} ${text.slice(0, 200)}`)
  const body = JSON.parse(text) as Json
  const keys = Object.keys(body).sort().join(",")
  if (keys !== "code,error" || body.code !== code || typeof body.error !== "string") fail(`${what}: expected {error, code:${code}}, got ${text}`)
  if (/\bat .*\(|\n\s+at |stack|Error:|0x[0-9a-f]{8,}.*revert/i.test(text)) fail(`${what}: body leaks internals: ${text}`)
  pass(`${what} → ${status} {error, code:"${code}"}: "${body.error}"`)
}

/** The custom error CollateralMarket.borrow(amount) reverts with at `block`, or undefined when it would pass. */
function simulateBorrow(fork: ForkChain, market: Address, who: Address, amount: bigint, block: bigint): Promise<string | undefined> {
  return fork.client
    .simulateContract({ address: market, abi: collateralMarketAbi, functionName: "borrow", args: [amount], account: who, blockNumber: block })
    .then(() => undefined, (e: unknown) => {
      const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null
      return rev instanceof ContractFunctionRevertedError ? (rev.data?.errorName ?? "unknown revert") : `call failed: ${String(e).slice(0, 120)}`
    })
}

/** Every field of the report, rebuilt independently from direct contract reads at the report's block. */
async function expected(fork: ForkChain, d: Deployment, who: Address, block: bigint, network: string): Promise<Json> {
  const m = d.markets.find((x) => x.symbol === "NVDAx")!
  const r = <T>(address: string, abi: Abi, functionName: string, args: readonly unknown[] = []) =>
    fork.client.readContract({ address: address as Address, abi, functionName, args, blockNumber: block } as never) as Promise<T>
  const [shares, debt] = await r<[bigint, bigint]>(m.market, collateralMarketAbi, "positionOf", [who])
  const [assets, value, sessionIdx, maxLtv, post, [priceE18, fetchedAt], guard, caPaused, issuerPaused, lt, totalDebt, liquidatable, cap, idle, chainId, blk] =
    await Promise.all([
      r<bigint>(m.wrapper, wrapperAbi, "convertToAssets", [shares]),
      r<bigint>(m.market, collateralMarketAbi, "valueOf", [shares]),
      r<number>(d.sessionRisk, sessionRiskControllerAbi, "currentSession"),
      r<bigint>(d.sessionRisk, sessionRiskControllerAbi, "maxLtvBps"),
      r<[number, bigint, bigint]>(d.sessionRisk, sessionRiskControllerAbi, "lastPost"),
      r<[bigint, bigint]>(m.priceRelay, priceRelayAdapterAbi, "latestPrice"),
      r<{ fresh: boolean; inBand: boolean; pegOk: boolean }>(m.priceRelay, priceRelayAdapterAbi, "guardStatus"),
      r<boolean>(m.corporateActionGuard, corporateActionGuardAbi, "isPaused"),
      r<boolean>(m.market, collateralMarketAbi, "issuerPaused"),
      r<bigint>(m.market, collateralMarketAbi, "LIQUIDATION_THRESHOLD_BPS"),
      r<bigint>(m.market, collateralMarketAbi, "totalDebt"),
      r<boolean>(m.market, collateralMarketAbi, "isLiquidatable", [who]),
      r<bigint>(d.depthCaps, depthCapRegistryAbi, "capOf", [m.market]),
      r<bigint>(d.vault, lendingVaultAbi, "idle"),
      fork.client.getChainId(),
      fork.client.getBlock({ blockNumber: block }),
    ])
  const session = sessionFromIndex(Number(sessionIdx))
  // CollateralMarket.borrow's checks in order, for a 1-unit borrow (its LTV rounds up).
  const ltvAfter = value === 0n ? MAX : ((debt + 1n) * 10_000n + value - 1n) / value
  const reason = issuerPaused ? "IssuerPaused" : session === "UNKNOWN" ? "UnknownSession" : ltvAfter > maxLtv ? "SessionLimit"
    : !guard.fresh ? "StalePrice" : !guard.inBand ? "PriceOutOfBand" : caPaused ? "CorporateActionPending"
    : totalDebt + 1n > cap ? "TickerCapReached" : !guard.pegOk ? "UsdgOffPeg" : idle < 1n ? "InsufficientLiquidity" : undefined
  const simulated = await simulateBorrow(fork, m.market as Address, who, 1n, block)
  if (simulated !== reason) fail(`${who}: computed refusal ${reason ?? "none"} but borrow(1) simulates ${simulated ?? "success"}`)
  const liqE18 = debt === 0n || assets === 0n ? null : (debt * 10n ** 30n * 10_000n) / (assets * lt)
  const gap = debt === 0n || priceE18 === 0n ? null : liqE18 === null || liqE18 >= priceE18 ? 0 : Number(((priceE18 - liqE18) * 10_000n) / priceE18)
  const capacity = reason ? 0n : min(pos((value * maxLtv) / 10_000n - debt), pos(cap - totalDebt), idle)
  return {
    service: "intatto-credit", version: "1", network, chainId, block: Number(block), wallet: getAddress(who), market: "NVDAx",
    session: { state: session, maxNewBorrowLtvBps: Number(maxLtv), periodChangedAt: iso(post[1]), postedAt: iso(post[2]) },
    price: { usdPerToken: priceE18 === 0n ? null : formatUnits(priceE18, 18), fetchedAt: iso(fetchedAt), sourceTimestamp: null, source: PRICE_SOURCE },
    guards: { fresh: guard.fresh, inBand: guard.inBand, pegOk: guard.pegOk, corporateActionPaused: caPaused, issuerPaused },
    position: {
      collateralTokens: formatUnits(assets, 18), collateralWrapperShares: formatUnits(shares, 18),
      valueUsdg: formatUnits(value, 6), debtUsdg: formatUnits(debt, 6),
      ltvBps: debt === 0n ? 0 : value === 0n ? null : Number((debt * 10_000n) / value),
      healthFactor: debt === 0n ? null : formatUnits((value * lt * 10n ** 18n) / (debt * 10_000n), 18),
    },
    capacity: { borrowableNowUsdg: formatUnits(capacity, 6), limitBps: Number(maxLtv), ...(reason ? { reason } : {}) },
    liquidation: { thresholdBps: Number(lt), liquidationPriceUsd: liqE18 === null ? null : formatUnits(liqE18, 18), gapToLiquidationBps: gap, liquidatableNow: liquidatable },
    asOf: new Date(Number(blk.timestamp) * 1000).toISOString(),
  }
}

async function compare(fork: ForkChain, d: Deployment, who: Address, label: string): Promise<Json> {
  const res = await get(`wallet=${who}&market=NVDAx&network=sandbox`)
  const text = await res.text()
  if (res.status !== 200) fail(`${label}: expected 200, got ${res.status} ${text.slice(0, 300)}`)
  const body = JSON.parse(text) as Json
  const want = flatten(await expected(fork, d, who, BigInt(body.block as number), "sandbox"))
  const got = flatten(body)
  const keys = new Set([...Object.keys(want), ...Object.keys(got)])
  let numeric = 0
  for (const k of keys) {
    if (!(k in got)) fail(`${label}: response is missing ${k}`)
    if (!(k in want)) fail(`${label}: response has unexpected field ${k}`)
    if (got[k] !== want[k]) fail(`${label}: ${k} = ${JSON.stringify(got[k])}, direct reads give ${JSON.stringify(want[k])}`)
    if (typeof want[k] === "number" || (typeof want[k] === "string" && /^-?\d+(\.\d+)?$/.test(want[k] as string))) numeric++
  }
  pass(`${label}: all ${keys.size} fields (${numeric} numeric) match direct reads of market, relay, session risk, caps and vault (no MarketLens) at block ${body.block}`)
  return body
}

async function sandbox() {
  const h = await startForkHarness().catch((e) => fail(`harness did not start: ${e instanceof Error ? e.message : e}`))
  try {
    const { fork, deployment: d, env } = h
    const m = d.markets.find((x) => x.symbol === "NVDAx")!
    const chain = { ...xLayer, id: env.chainId, rpcUrls: { default: { http: [env.rpcUrl] } } } as Chain
    const account = privateKeyToAccount(env.burnerKey)
    const wallet = createWalletClient({ account, chain, transport: http(env.rpcUrl) })
    const send = async (to: string, abi: Abi, functionName: string, args: readonly unknown[]) => {
      const hash = await wallet.writeContract({ address: to as Address, abi, functionName, args, account, chain } as never)
      const rc = await fork.client.waitForTransactionReceipt({ hash, pollingInterval: 250 })
      if (rc.status !== "success") fail(`burner ${functionName} reverted (${hash})`)
    }
    const collateral = 4n * 10n ** 18n
    await send(m.token, erc20Abi, "approve", [m.market, collateral])
    await send(m.market, collateralMarketAbi, "addCollateral", [collateral])
    const [shares] = await fork.read<[bigint, bigint]>(m.market as Address, collateralMarketAbi, "positionOf", [env.burnerAddress])
    const value = await fork.read<bigint>(m.market as Address, collateralMarketAbi, "valueOf", [shares])
    const limit = await fork.read<bigint>(d.sessionRisk as Address, sessionRiskControllerAbi, "maxLtvBps")
    const target = min(3_000n, (limit * 9n) / 10n)
    if (target === 0n) fail(`session limit is ${limit} bps at the fork block; cannot open a position`)
    const borrow = (value * target) / 10_000n
    await send(m.market, collateralMarketAbi, "borrow", [borrow])
    pass(`burner signed its own txs: 4 NVDAx collateral ($${formatUnits(value, 6)}), borrowed ${formatUnits(borrow, 6)} USDG (${Number(target) / 100}% LTV, session limit ${Number(limit) / 100}%)`)

    delete process.env.CREDIT_PAYMENT_MODE
    delete process.env.LIVE_DEPLOYMENT
    delete process.env.NEXT_PUBLIC_LIVE_DEPLOYMENT
    process.env.CREDIT_SANDBOX_RPC = env.rpcUrl
    process.env.CREDIT_SANDBOX_DEPLOYMENT = JSON.stringify(d)

    const b = await compare(fork, d, env.burnerAddress, `burner ${env.burnerAddress}`)
    const p = b.position as Json, c = b.capacity as Json, l = b.liquidation as Json
    if (Math.abs(Number(p.ltvBps) - Number(target)) > 2) fail(`burner LTV ${p.ltvBps} bps, expected ~${target}`)
    if (c.reason !== undefined || Number(c.borrowableNowUsdg) <= 0) fail(`burner should be able to borrow more, got ${JSON.stringify(c)}`)
    if (typeof l.gapToLiquidationBps !== "number" || l.gapToLiquidationBps <= 0) fail(`burner gap to liquidation ${l.gapToLiquidationBps}`)
    const room = parseUnits(c.borrowableNowUsdg as string, 6)
    const [atCap, overCap] = await Promise.all([room, room + 1n].map((x) => simulateBorrow(fork, m.market as Address, env.burnerAddress, x, BigInt(b.block as number))))
    if (atCap !== undefined || overCap !== "SessionLimit") fail(`borrowableNowUsdg is not the edge: borrow(room) → ${atCap ?? "ok"}, borrow(room+1) → ${overCap ?? "ok"}`)
    pass(`borrowableNowUsdg is the exact edge: borrow(${c.borrowableNowUsdg}) simulates ok, one unit more reverts SessionLimit`)
    pass(`burner: LTV ${p.ltvBps} bps, health ${Number(p.healthFactor).toFixed(3)}, borrowable ${c.borrowableNowUsdg} USDG, liquidation at $${Number(l.liquidationPriceUsd).toFixed(2)} (${Number(l.gapToLiquidationBps) / 100}% below)`)

    const fresh = privateKeyToAccount(generatePrivateKey()).address
    const e = await compare(fork, d, fresh, `empty wallet ${fresh}`)
    const ec = e.capacity as Json
    if ((e.position as Json).debtUsdg !== "0" || ec.reason !== "SessionLimit" || ec.borrowableNowUsdg !== "0") fail(`empty wallet: ${JSON.stringify(e)}`)
    pass(`empty wallet: no collateral, borrowableNowUsdg 0, reason ${ec.reason} (matches a simulated borrow)`)

    await expectError(await get("wallet=0x12345&market=NVDAx&network=sandbox"), 400, "INVALID_WALLET", "short wallet")
    // The fork keeper's address with one letter's case flipped (…12Dc3A… instead of …12dc3A…).
    await expectError(await get("wallet=0x70997970C51812Dc3A010C7d01b50e0d17dc79C8&market=NVDAx&network=sandbox"), 400, "INVALID_WALLET", "bad EIP-55 checksum")
    await expectError(await get(`market=NVDAx&network=sandbox`), 400, "INVALID_WALLET", "missing wallet")
    await expectError(await get(`wallet=${fresh}&market=TSLAx&network=sandbox`), 400, "INVALID_MARKET", "unknown market")
    await expectError(await get(`wallet=${fresh}&market=NVDAx&network=testnet`), 400, "INVALID_NETWORK", "unknown network")
    await expectError(await get(`wallet=${fresh}&market=SPYx&network=sandbox`), 404, "MARKET_NOT_LISTED", "market not in this deployment")
    await expectError(await get(`wallet=${fresh}&market=NVDAx`), 503, "NOT_DEPLOYED", "mainnet before deployment")

    const hr = await HEALTH(new Request(`${API}/health?network=sandbox`))
    const hb = (await hr.json()) as Json
    if (hr.status !== 200 || hb.ok !== true || hb.network !== "sandbox" || typeof hb.block !== "number") fail(`health: ${hr.status} ${JSON.stringify(hb)}`)
    pass(`health (sandbox) → ${JSON.stringify(hb)}`)

    // Hosted path: a stand-in for the sandbox session API (GET /session/<id> → { rpcUrl, chainId, deployment }).
    const srv = createServer((q, s) => {
      const hit = q.url === "/session/sbx_check1"
      s.writeHead(hit ? 200 : 404, { "content-type": "application/json" })
      s.end(JSON.stringify(hit ? { rpcUrl: env.rpcUrl, chainId: env.chainId, forkBlock: env.forkBlock, deployment: d } : { error: "unknown session" }))
    })
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok))
    process.env.SANDBOX_API_URL = `http://127.0.0.1:${(srv.address() as { port: number }).port}`
    const viaSession = await get(`wallet=${env.burnerAddress}&market=NVDAx&network=sandbox&session=sbx_check1`)
    const vs = (await viaSession.json()) as Json
    if (viaSession.status !== 200 || JSON.stringify(vs) !== JSON.stringify(b)) fail(`session path differs from the direct fork read: ${JSON.stringify(vs).slice(0, 300)}`)
    pass("session=<id> resolves through the sandbox session API and returns the identical report")
    await expectError(await get(`wallet=${fresh}&market=NVDAx&network=sandbox&session=sbx_expired`), 404, "SESSION_NOT_FOUND", "unknown sandbox session")
    await expectError(await get(`wallet=${fresh}&market=NVDAx&network=sandbox&session=../../admin`), 400, "INVALID_SESSION", "malformed session id")
    await expectError(await get(`wallet=${fresh}&market=NVDAx&session=sbx_check1`), 400, "INVALID_SESSION", "session with network=mainnet")
    srv.close()
    delete process.env.SANDBOX_API_URL
    process.env.CREDIT_SANDBOX_RPC = "http://127.0.0.1:9"
    await expectError(await get(`wallet=${fresh}&market=NVDAx&network=sandbox`), 503, "CHAIN_UNAVAILABLE", "RPC down")
    process.env.CREDIT_SANDBOX_RPC = env.rpcUrl
    process.env.CREDIT_SANDBOX_DEPLOYMENT = "{\"chainId\":1960196"
    await expectError(await get(`wallet=${fresh}&market=NVDAx&network=sandbox`), 503, "DEPLOYMENT_INVALID", "unparseable deployment")
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
  } finally {
    await h.stop()
  }
}

/** The x402 v2 PaymentRequired schema as @okxweb3/x402-core 0.1.0 (schemas/PaymentRequiredSchema) defines it. */
const paymentRequiredSchema = z.object({
  x402Version: z.literal(2),
  error: z.string().optional(),
  resource: z.object({ url: z.string().min(1), description: z.string().optional(), mimeType: z.string().optional() }),
  accepts: z.array(z.object({
    scheme: z.string().min(1), network: z.string().min(3).refine((v) => v.includes(":")), amount: z.string().min(1),
    asset: z.string().min(1), payTo: z.string().min(1), maxTimeoutSeconds: z.number().positive(),
    extra: z.record(z.unknown()).optional().nullable(),
  })).min(1),
  extensions: z.record(z.unknown()).optional().nullable(),
})

async function paid() {
  const payTo = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" // fixed operator address for the check (the fork deployer)
  const who = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  for (const k of ["LIVE_DEPLOYMENT", "NEXT_PUBLIC_LIVE_DEPLOYMENT", "CREDIT_SANDBOX_RPC", "CREDIT_SANDBOX_DEPLOYMENT", "CREDIT_PRICE_USDG_UNITS"]) delete process.env[k]
  delete process.env.CREDIT_PAYMENT_MODE
  const free = await get(`wallet=${who}&market=NVDAx`)
  if (free.status === 402) fail("default mode must be free, got 402")
  pass(`default mode is free: no challenge (HTTP ${free.status})`)

  process.env.CREDIT_PAYMENT_MODE = "paid"
  process.env.CREDIT_PAY_TO = payTo
  for (const units of [undefined, "25000"]) {
    if (units) process.env.CREDIT_PRICE_USDG_UNITS = units
    const url = `${API}?wallet=${who}&market=NVDAx`
    const res = await GET(new Request(url))
    const header = res.headers.get("PAYMENT-REQUIRED")
    if (res.status !== 402 || !header) fail(`expected 402 with PAYMENT-REQUIRED, got ${res.status} header=${header}`)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(header)) fail("PAYMENT-REQUIRED is not base64")
    const decoded = paymentRequiredSchema.safeParse(JSON.parse(Buffer.from(header, "base64").toString("utf8")))
    if (!decoded.success) fail(`PAYMENT-REQUIRED does not match the x402 v2 schema: ${decoded.error.issues[0]?.message}`)
    const c = decoded.data, a = c.accepts[0]!
    const want = { scheme: "exact", network: "eip155:196", asset: XLAYER.usdg, amount: units ?? "10000", payTo, maxTimeoutSeconds: 300 }
    for (const [k, v] of Object.entries(want)) if ((a as Json)[k] !== v) fail(`accepts[0].${k} = ${(a as Json)[k]}, expected ${v}`)
    if (a.extra?.name !== "Global Dollar" || a.extra?.version !== "1") fail(`USDG EIP-712 extra wrong: ${JSON.stringify(a.extra)}`)
    if (c.resource.url !== url || c.resource.mimeType !== "application/json" || !c.resource.description) fail(`resource wrong: ${JSON.stringify(c.resource)}`)
    const body = (await res.json()) as Json
    if (body.code !== "PAYMENT_REQUIRED" || typeof body.error !== "string") fail(`402 body: ${JSON.stringify(body)}`)
    pass(`402 challenge (${units ? "CREDIT_PRICE_USDG_UNITS=" + units : "default price"}): network ${a.network}, asset ${a.asset} (USDG), amount ${a.amount} (${formatUnits(BigInt(a.amount), 6)} USDG), payTo ${a.payTo}, timeout ${a.maxTimeoutSeconds}s`)
  }

  const signed = await GET(new Request(`${API}?wallet=${who}&market=NVDAx`, { headers: { "PAYMENT-SIGNATURE": "eyJ4NDAyVmVyc2lvbiI6Mn0=" } }))
  const sb = (await signed.json()) as Json
  if (signed.status !== 402 || sb.code !== "PAYMENT_NOT_VERIFIED" || !signed.headers.get("PAYMENT-REQUIRED")) fail(`a request carrying a payment must not be served: ${signed.status} ${JSON.stringify(sb)}`)
  pass("a request carrying PAYMENT-SIGNATURE is not served or settled (verification not wired): 402 PAYMENT_NOT_VERIFIED")
  await expectError(await get(`wallet=nope&market=NVDAx`), 400, "INVALID_WALLET", "paid mode still validates before charging")
  const hr = await HEALTH(new Request(`${API}/health`))
  if (hr.status === 402) fail("health must stay free in paid mode")
  pass(`health stays free in paid mode (HTTP ${hr.status})`)
  process.env.CREDIT_PAY_TO = "0xnot-an-address"
  await expectError(await get(`wallet=${who}&market=NVDAx`), 503, "PAYWALL_MISCONFIGURED", "paid mode with a bad CREDIT_PAY_TO")
  pass("paid mode built challenges only: nothing was paid or settled")
}

const args = process.argv.slice(2)
const mode = args[args.indexOf("--mode") + 1]
if (mode === "sandbox") await sandbox()
else if (mode === "paid" && args.includes("--challenge-only")) await paid()
else fail("usage: npx tsx checks/credit-api.ts --mode sandbox | --mode paid --challenge-only")
