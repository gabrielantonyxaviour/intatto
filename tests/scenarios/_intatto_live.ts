/**
 * Live-mode journey pieces (sc_keeper_live): Intatto on X Layer mainnet, read-only. The app is the public deployment
 * (baseURL), the chain is read through the X Layer RPC, the keeper's own log through its public endpoint. Nothing
 * here signs or sends a transaction.
 */
import { readFileSync } from "node:fs"
import { createPublicClient, fallback, http, parseAbiItem, type Address, type Hex, type PublicClient } from "viem"
import { marketLensAbi, priceRelayAdapterAbi } from "@intatto/config/abi"
import { parseDeployment } from "@intatto/config/deployments"
import { SESSIONS } from "@intatto/config/session"
import { xlayerRpcUrls } from "@intatto/config/xlayer"
import type { StepArgs } from "./_abel"
import { expect, pct, shows, usd, usdg, utc } from "./_intatto"

type Page = StepArgs["page"]

export const KEEPER_URL = "https://intatto-keeper.larinova.com"
export const EVENTS = {
  price: parseAbiItem("event PricePosted(uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18, uint256 deviationBps, uint256 moveBps, int256 usdgAnswer, uint64 fetchedAt, uint64 sourceTimestamp)"),
  rejected: parseAbiItem("event PriceRejected(uint8 reason, uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18, uint256 deviationBps, uint64 fetchedAt)"),
  session: parseAbiItem("event SessionPosted(uint8 session, uint64 periodChangedAt, uint64 postedAt)"),
  cap: parseAbiItem("event CapPosted(address indexed market, uint256 targetCapUsdg, uint256 sliceUsdg, uint256 effectiveCapUsdg)"),
  action: parseAbiItem("event ActionPosted(uint64 activationAt, uint256 expectedMultiplier, uint256 preActionMultiplier, uint256 preActionPrice)"),
}

export type LogEntry = { id: number; at: string; market: string; kind: string; detail: string; data?: Record<string, unknown>; txHash?: string | null }

export function mainnet() {
  const d = parseDeployment(JSON.parse(readFileSync(new URL("../../deployments/xlayer-mainnet.json", import.meta.url), "utf8")))
  const client = createPublicClient({ transport: fallback(xlayerRpcUrls().map((u) => http(u, { timeout: 30_000 }))) }) as PublicClient
  const nvda = d.markets.find((m) => m.symbol === "NVDAx")!
  const lensMarket = () =>
    client.readContract({ address: d.lens as Address, abi: marketLensAbi, functionName: "market", args: [nvda.market as Address] }) as Promise<{
      session: number; periodChangedAt: bigint; sessionPostedAt: bigint; maxLtvBps: bigint; priceE18: bigint; fetchedAt: bigint; fresh: boolean; inBand: boolean; pegOk: boolean; capUsdg: bigint; totalDebt: bigint
    }>
  return { d, client, nvda, keeper: d.keeper.toLowerCase(), lensMarket }
}

export async function keeperLog(limit = 50): Promise<LogEntry[]> {
  return ((await (await fetch(`${KEEPER_URL}/log?limit=${limit}`)).json()) as { actions: LogEntry[] }).actions
}

export async function keeperHealth() {
  return (await (await fetch(`${KEEPER_URL}/health`)).json()) as { ok: boolean; lastCycle?: { at: string; chainTime: number; actions: number; sent: number; failures: number; durationMs: number } }
}

/** A keeper transaction: mined, successful, sent by the keeper to `to`. */
export async function keeperTx(hash: Hex, to: string) {
  const { client, keeper } = mainnet()
  const r = await client.getTransactionReceipt({ hash })
  expect([r.status, r.from.toLowerCase(), r.to?.toLowerCase()]).toEqual(["success", keeper, to.toLowerCase()])
  return r
}

/** Risk console at `view` (desktop nav), once its event scan is in. Returns the scanned block range. */
export async function openRisk(page: Page, view: string, label: string) {
  if (!/\/risk/.test(page.url())) await page.goto(`/risk#${view}`)
  else await page.getByRole("navigation", { name: "Risk analyses" }).getByRole("link", { name: label, exact: true }).click()
  await expect(page.getByTestId("risk-console")).toHaveAttribute("data-view", view, { timeout: 120_000 })
  const scan = page.getByTestId("risk-scan")
  await expect(scan).toContainText("Events from blocks", { timeout: 120_000 })
  const m = (await scan.innerText()).match(/#([\d,]+)–#([\d,]+)/)!
  return { from: BigInt(m[1]!.replace(/,/g, "")), to: BigInt(m[2]!.replace(/,/g, "")) }
}

/** Every keeper-sent event in [from, to], newest first, as the console orders them. */
export async function keeperEvents(from: bigint, to: bigint) {
  const { client, d, nvda } = mainnet()
  const [prices, sessions, caps, actions] = await Promise.all([
    client.getLogs({ address: nvda.priceRelay as Address, events: [EVENTS.price, EVENTS.rejected], fromBlock: from, toBlock: to }),
    client.getLogs({ address: d.sessionRisk as Address, event: EVENTS.session, fromBlock: from, toBlock: to }),
    client.getLogs({ address: d.depthCaps as Address, event: EVENTS.cap, args: { market: nvda.market as Address }, fromBlock: from, toBlock: to }),
    client.getLogs({ address: nvda.corporateActionGuard as Address, event: EVENTS.action, fromBlock: from, toBlock: to }),
  ])
  const all = [...prices, ...sessions, ...caps, ...actions]
  return all.sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex! - a.logIndex! : a.blockNumber! > b.blockNumber! ? -1 : 1))
}

/** Market (live): session, price with the keeper's fetch time, and cap usage equal fresh contract reads. */
export async function marketMatchesChain(page: Page) {
  const { lensMarket } = mainnet()
  await page.goto("/")
  const detail = page.getByTestId("market-detail-NVDAx")
  await expect(detail).toBeVisible({ timeout: 180_000 })
  const session = await shows("session", () => detail.getByTestId("session-value").getAttribute("data-session"), async () => SESSIONS[(await lensMarket()).session]!)
  const price = await shows("price", () => detail.getByTestId("price-value").textContent(), async () => usd((await lensMarket()).priceE18))
  const fetched = await shows("fetched at", () => detail.getByTestId("price-fetched-at").textContent(), async () => utc((await lensMarket()).fetchedAt))
  const capUsed = await shows("cap usage", () => page.getByTestId("cap-used").textContent(), async () => {
    const m = await lensMarket()
    return pct(m.capUsdg === 0n ? 0n : (m.totalDebt * 10_000n) / m.capUsdg)
  })
  const m = await lensMarket()
  return `Market (live, X Layer 196): session ${session} = currentSession; price ${price} "fetched by the keeper at ${fetched}" = PriceRelayAdapter.latestPrice; cap usage ${capUsed} = total debt ${usdg(m.totalDebt)} of cap ${usdg(m.capUsdg)} (MarketLens)`
}

export { priceRelayAdapterAbi }
