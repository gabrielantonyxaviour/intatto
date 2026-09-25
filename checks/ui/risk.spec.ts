/** Risk console against a local X Layer fork: rows match events, and a past-the-line loan is worded without a double sign. */
import type { Page } from "@playwright/test"
import { maxUint256, parseAbiItem, type Address, type Hex } from "viem"
import { marketLensAbi } from "@intatto/config/abi"
import { SESSIONS } from "@intatto/config/session"
import { TICKERS, XLAYER } from "@intatto/config/xlayer"
import { test, expect, viewports, expectNoHorizontalScroll } from "./fixtures"
import { startForkHarness, type ForkHarness } from "../fork/harness.ts"
import { HOLDER, poolWrapperPrice } from "../fork/lib/actors.ts"
import { ensureOpen, keeperTick, openPosition } from "../fork/lib/scenarios.ts"
import * as abi from "../fork/lib/abis.ts"

const REASONS = ["FutureFetch", "StaleFetch", "NotNewer", "UsdgStale", "UsdgOffPeg", "TwapUnavailable", "OutOfBand", "MaxMove"]
const PRICE_POSTED = parseAbiItem(
  "event PricePosted(uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18, uint256 deviationBps, uint256 moveBps, int256 usdgAnswer, uint64 fetchedAt, uint64 sourceTimestamp)",
)
const PRICE_REJECTED = parseAbiItem(
  "event PriceRejected(uint8 reason, uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18, uint256 deviationBps, uint64 fetchedAt)",
)
const SESSION_POSTED = parseAbiItem("event SessionPosted(uint8 session, uint64 periodChangedAt, uint64 postedAt)")
const CAP_POSTED = parseAbiItem("event CapPosted(address indexed market, uint256 targetCapUsdg, uint256 sliceUsdg, uint256 effectiveCapUsdg)")
const ACTION_POSTED = parseAbiItem("event ActionPosted(uint64 activationAt, uint256 expectedMultiplier, uint256 preActionMultiplier, uint256 preActionPrice)")

/** Two scenario borrowers with keyless addresses, driven by impersonation on the fork only. */
const LOW = "0x000000000000000000000000000000000000b0b1" as Address
const HIGH = "0x000000000000000000000000000000000000b0b2" as Address
const CAP_TARGET = 40_000n * 10n ** 6n
const CAP_SLICE = 2_000n * 10n ** 6n

let h: ForkHarness

const dollars = (v: bigint) => { const c = v / 10n ** 16n; return `$${(c / 100n).toLocaleString("en-US")}.${(c % 100n).toString().padStart(2, "0")}` }
const usdgText = (v: bigint) => `${(v / 10n ** 6n).toLocaleString("en-US")}.${((v % 10n ** 6n) / 10n ** 4n).toString().padStart(2, "0")} USDG`
const pct = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`
const newestFirst = <T extends { blockNumber: bigint | null; logIndex: number | null }>(logs: T[]) =>
  [...logs].sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex! - a.logIndex! : a.blockNumber! > b.blockNumber! ? -1 : 1))

function nvda() {
  return h.deployment.markets.find((m) => m.symbol === "NVDAx")!
}

const VIEW_IDS: Record<string, string> = {
  Summary: "summary",
  "Price posts": "prices",
  "Price shock": "shock",
  "Loans near liquidation": "loans",
  "Caps and LTV spread": "caps",
  "Market overview": "overview",
  Sessions: "sessions",
  "Corporate actions": "actions",
  Liquidations: "liquidations",
  "Keeper log": "keeper",
  "Trust and bounds": "trust",
}

async function openView(page: Page, label: string) {
  const wide = (page.viewportSize()?.width ?? 0) >= 1024
  if (wide) {
    await page.getByRole("navigation", { name: "Risk analyses" }).getByRole("link", { name: label, exact: true }).click()
  } else {
    await page.getByTestId("risk-view-picker").click()
    await page.getByRole("option", { name: label, exact: true }).click()
    await expect(page.getByRole("listbox")).toBeHidden()
  }
  await expect(page.getByTestId("risk-console")).toHaveAttribute("data-view", VIEW_IDS[label]!)
  await expect(page).toHaveURL(new RegExp(`#${VIEW_IDS[label]}$`))
}

async function start(page: Page, useFork: (p: Page, e: ForkHarness["env"]) => Promise<void>, hash = "") {
  await useFork(page, h.env)
  await page.goto(`/risk${hash}`)
  await expect(page.getByTestId("risk-console")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId("risk-scan")).toContainText("Events from blocks", { timeout: 60_000 })
}

async function expectReceipts(page: Page, scope: string) {
  const hashes = await page.locator(`${scope} [data-tx]:visible`).evaluateAll((els) => els.map((e) => e.getAttribute("data-tx")!))
  expect(hashes.length).toBeGreaterThan(0)
  for (const hash of new Set(hashes)) {
    const receipt = await h.fork.client.getTransactionReceipt({ hash: hash as Hex })
    expect(receipt.status, `receipt for ${hash}`).toBe("success")
  }
  return hashes
}
test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  test.setTimeout(300_000)
  h = await startForkHarness()
  await openPosition(h.ctx, LOW, 2n * 10n ** 18n, 1_000)
  await openPosition(h.ctx, HIGH, 2n * 10n ** 18n, 1_800)
  await h.fork.warpBy(60, "risk check: next keeper cycle")
  const tick = await keeperTick(h.ctx)
  expect(tick.accepted).toBe(true)
  await h.ctx.keeper.cap(CAP_TARGET, CAP_SLICE)
  await h.fork.warpBy(60, "risk check: out-of-band post")
  const [quote] = await h.fork.read<[bigint, bigint]>(nvda().priceRelay as Address, abi.priceRelay, "latestPrice")
  const bad = await h.ctx.keeper.price((quote * 125n) / 100n)
  expect(bad.accepted).toBe(false)
})
test.afterAll(async () => {
  await h?.stop()
})
test("price posts equal the relay's events, rejection included, and every tx has a receipt", async ({ page, useFork }) => {
  test.setTimeout(240_000)
  await page.setViewportSize(viewports.wide)
  await start(page, useFork)
  await openView(page, "Price posts")

  const events = newestFirst(
    await h.fork.client.getLogs({ address: nvda().priceRelay as Address, events: [PRICE_POSTED, PRICE_REJECTED], fromBlock: BigInt(h.deployment.block) }),
  )
  expect(events.filter((e) => e.eventName === "PriceRejected")).toHaveLength(1)
  const rows = page.locator('[data-row="price-post"]:visible')
  await expect(rows).toHaveCount(events.length, { timeout: 60_000 })
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!
    const row = rows.nth(i)
    await expect(row).toHaveAttribute("data-tx-hash", e.transactionHash!)
    await expect(row).toHaveAttribute("data-quote", e.args.quoteE18!.toString())
    await expect(row.locator('[data-value="quote"]')).toHaveText(dollars(e.args.quoteE18!))
    if (e.eventName === "PriceRejected") {
      const reason = REASONS[Number(e.args.reason)]!
      expect(reason).toBe("OutOfBand")
      await expect(row).toHaveAttribute("data-status", "rejected")
      await expect(row).toHaveAttribute("data-reason", reason)
      await expect(row).toContainText(`Rejected · ${reason}`)
      await expect(row.locator('[data-value="deviation"]')).toContainText(pct(e.args.deviationBps!))
      await expect(row.locator('[data-check="fail"]')).toHaveCount(1)
    } else {
      await expect(row).toHaveAttribute("data-status", "accepted")
      await expect(row).toContainText("Accepted")
    }
  }
  const hashes = await expectReceipts(page, '[data-section="prices"]')
  expect(new Set(hashes)).toEqual(new Set(events.map((e) => e.transactionHash)))

  await page.getByRole("tab", { name: /^Rejected/ }).click()
  await expect(rows).toHaveCount(1)
  await page.getByRole("tab", { name: /^All/ }).click()
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/risk.png", fullPage: true })
})
test("keeper log merges every keeper-sent event and links each to its transaction", async ({ page, useFork }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(viewports.wide)
  await start(page, useFork, "#keeper")
  const d = h.deployment
  const fromBlock = BigInt(d.block)
  const [prices, sessions, caps, actions] = await Promise.all([
    h.fork.client.getLogs({ address: nvda().priceRelay as Address, events: [PRICE_POSTED, PRICE_REJECTED], fromBlock }),
    h.fork.client.getLogs({ address: d.sessionRisk as Address, event: SESSION_POSTED, fromBlock }),
    h.fork.client.getLogs({ address: d.depthCaps as Address, event: CAP_POSTED, args: { market: nvda().market as Address }, fromBlock }),
    h.fork.client.getLogs({ address: nvda().corporateActionGuard as Address, event: ACTION_POSTED, fromBlock }),
  ])
  const expected = newestFirst([...prices, ...sessions, ...caps, ...actions])
  const rows = page.locator('[data-row="keeper-action"]:visible')
  await expect(rows).toHaveCount(expected.length, { timeout: 60_000 })
  const shown = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-tx-hash")))
  expect(shown).toEqual(expected.map((e) => e.transactionHash))
  const hashes = await expectReceipts(page, '[data-section="keeper"]')
  for (const hash of new Set(hashes)) {
    const tx = await h.fork.client.getTransaction({ hash: hash as Hex })
    expect(tx.from.toLowerCase()).toBe(d.keeper.toLowerCase())
  }
  await expect(page.getByTestId("keeper-count")).toContainText(String(expected.length))
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/risk-keeper.png", fullPage: true })
})
test("summary, caps and loans equal the contracts", async ({ page, useFork }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(viewports.wide)
  await start(page, useFork)
  const m = nvda()
  const k = await h.fork.client.readContract({ address: h.deployment.lens as Address, abi: marketLensAbi, functionName: "market", args: [m.market as Address] })
  const v = await h.fork.client.readContract({ address: h.deployment.lens as Address, abi: marketLensAbi, functionName: "vault", args: [m.market as Address] })
  await expect(page.locator('[data-tile="session"] [data-tile-value]')).toHaveText(SESSIONS[k.session]!, { timeout: 60_000 })
  await expect(page.locator('[data-tile="max-ltv"] [data-tile-value]')).toHaveText(pct(k.maxLtvBps))
  await expect(page.locator('[data-tile="price"] [data-tile-value]')).toHaveText(dollars(k.priceE18))
  await expect(page.locator('[data-tile="reserve"] [data-tile-value]')).toHaveText(usdgText(v.reserveBalance))
  await expect(page.locator('[data-tile="deficit"] [data-tile-value]')).toHaveText(usdgText(v.totalDeficit))
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/risk-summary.png", fullPage: true })
  await openView(page, "Caps and LTV spread")
  const capRows = page.locator('[data-row="cap-post"]:visible')
  await expect(capRows).toHaveCount(1, { timeout: 30_000 })
  await expect(capRows.first()).toHaveAttribute("data-target", CAP_TARGET.toString())
  await expect(page.locator('[data-testid="cap-usage"] [data-value="cap"]')).toHaveText(usdgText(k.capUsdg))
  await openView(page, "Loans near liquidation")
  const loanRows = page.locator('[data-row="loan"]:visible')
  await expect(loanRows).toHaveCount(2, { timeout: 60_000 })
  const block = BigInt((await page.locator("[data-loans-block]").getAttribute("data-loans-block"))!)
  await expect(loanRows.nth(0)).toHaveAttribute("data-borrower", HIGH.toLowerCase())
  await expect(loanRows.nth(1)).toHaveAttribute("data-borrower", LOW.toLowerCase())
  for (const [i, who] of [HIGH, LOW].entries()) {
    const a = await h.fork.client.readContract({ address: h.deployment.lens as Address, abi: marketLensAbi, functionName: "account", args: [m.market as Address, who], blockNumber: block })
    await expect(loanRows.nth(i)).toHaveAttribute("data-ltv-bps", a.ltvBps.toString())
    await expect(loanRows.nth(i)).toHaveAttribute("data-debt", a.debt.toString())
    await expect(loanRows.nth(i).locator('[data-value="ltv"]')).toHaveText(pct(a.ltvBps))
  }
  await expectNoHorizontalScroll(page)
  await openView(page, "Price shock")
  await page.getByText("S2: Collateral at risk along the drop").click()
  let hit = 0
  for (const who of [HIGH, LOW]) {
    const a = await h.fork.client.readContract({ address: h.deployment.lens as Address, abi: marketLensAbi, functionName: "account", args: [m.market as Address, who], blockNumber: block })
    if (a.debt * 10_000n > ((a.valueUsdg * 100_000n) / 1_000_000n) * k.liquidationThresholdBps) hit++
  }
  await expect(page.locator('[data-scenario="S2"] li').last()).toContainText(`${hit} loan${hit === 1 ? "" : "s"}`)
  await openView(page, "Sessions")
  const sessionLogs = await h.fork.client.getLogs({ address: h.deployment.sessionRisk as Address, event: SESSION_POSTED, fromBlock: BigInt(h.deployment.block) })
  await expect(page.locator('[data-row="session-post"]:visible')).toHaveCount(sessionLogs.length)
  await expect(page.locator(`[data-session-row="${SESSIONS[k.session]}"]`)).toHaveClass(/bg-muted/)
})

for (const [name, size] of [["390", viewports.narrow], ["768", viewports.medium]] as const) {
  test(`views fit a ${name}px screen with cards instead of tables`, async ({ page, useFork }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(size)
    await start(page, useFork)
    await openView(page, "Price posts")
    const cards = page.locator('[data-section="prices"] [data-form="cards"] [data-row="price-post"]')
    await expect(cards.first()).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('[data-section="prices"] [data-form="table"]')).toBeHidden()
    await expectNoHorizontalScroll(page)
    const scan = (await page.getByTestId("risk-scan").boundingBox())!
    const text = (await page.getByTestId("risk-scan").locator("p").first().boundingBox())!
    expect(scan.x + scan.width).toBeLessThanOrEqual(size.width)
    expect(text.width).toBeGreaterThan(scan.width * 0.8)
    await page.screenshot({ path: `proof/risk-${name}.png`, fullPage: true })
    for (const view of ["Summary", "Price shock", "Loans near liquidation", "Caps and LTV spread", "Market overview", "Sessions", "Corporate actions", "Liquidations", "Keeper log", "Trust and bounds"]) {
      await openView(page, view)
      await expect(page.locator("[data-section]").first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })
}

test("a failing guard is named with what it refuses once the keeper goes quiet", async ({ page, useFork }) => {
  test.setTimeout(180_000)
  await h.fork.warpBy(31 * 60, "risk check: keeper silent for 31 minutes")
  const k = await h.fork.client.readContract({ address: h.deployment.lens as Address, abi: marketLensAbi, functionName: "market", args: [nvda().market as Address] })
  expect(k.fresh).toBe(false)
  expect(SESSIONS[k.session]).toBe("UNKNOWN")
  await page.setViewportSize(viewports.wide)
  await start(page, useFork)
  const alert = page.getByTestId("guard-alert")
  await expect(alert).toBeVisible({ timeout: 60_000 })
  await expect(alert.locator('[data-guard="UnknownSession"]')).toBeVisible()
  await expect(alert.locator('[data-guard="StalePrice"]')).toBeVisible()
  await expect(alert).toContainText("Repaying and adding collateral stay open")
  await expect(page.locator('[data-tile="max-ltv"] [data-tile-value]')).toHaveText(pct(k.maxLtvBps))
  await page.screenshot({ path: "proof/risk-guard-failed.png" })
})
async function dropSpot() {
  const t = TICKERS.NVDAx, fork = h.fork, w = t.wrapper as Address
  await fork.write(HOLDER, t.token as Address, abi.erc20, "approve", [w, maxUint256])
  await fork.write(HOLDER, w, abi.wrapper, "deposit", [(await fork.read<bigint>(t.token as Address, abi.erc20, "balanceOf", [HOLDER])) - 300n * 10n ** 18n, HOLDER])
  await fork.write(HOLDER, w, abi.erc20, "approve", [XLAYER.swapRouter02, maxUint256])
  const token0 = (await fork.read<Address>(t.pool as Address, abi.pool, "token0")).toLowerCase()
  const limit = token0 === w.toLowerCase() ? 4295128740n : 1461446703485210103287273052203988822378723970341n
  const start = await poolWrapperPrice(fork)
  let amount = 5n * 10n ** 18n
  for (let i = 0; i < 30 && (await poolWrapperPrice(fork)) > start * 0.72; i++) {
    const before = await poolWrapperPrice(fork)
    const have = await fork.read<bigint>(w, abi.erc20, "balanceOf", [HOLDER])
    const sell = amount > have ? have : amount
    if (sell < 10n ** 15n) break
    await fork.write(HOLDER, XLAYER.swapRouter02, abi.swapRouter02, "exactInputSingle", [{ tokenIn: w, tokenOut: XLAYER.usdg, fee: t.poolFee, recipient: HOLDER, amountIn: sell, amountOutMinimum: 0n, sqrtPriceLimitX96: limit }])
    const impact = before > 0 ? 1 - (await poolWrapperPrice(fork)) / before : 1
    amount = impact < 0.01 ? amount * 3n : impact > 0.06 ? amount / 2n || 1n : amount
  }
}

test("a loan past the liquidation line says how far past, with no double sign", async ({ page, useFork }) => {
  test.setTimeout(300_000)
  const relay = nvda().priceRelay as Address
  const own = [{ type: "function", name: "setMaxMove", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] }, { type: "function", name: "setBands", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [] }] as const
  await h.fork.write("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", relay, own, "setMaxMove", [100_000n])
  await h.fork.write("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", relay, own, "setBands", [5_000n, 5_000n])
  await ensureOpen(h.ctx)
  const past = "0x000000000000000000000000000000000000b0b3" as Address
  await openPosition(h.ctx, past, 2n * 10n ** 18n, 5_000)
  await dropSpot()
  await h.fork.warpBy(31 * 60, "risk check: 30-minute TWAP catches the lower spot")
  expect((await keeperTick(h.ctx)).accepted).toBe(true)
  const m = nvda().market as Address
  const lens = h.deployment.lens as Address
  const market = await h.fork.client.readContract({ address: lens, abi: marketLensAbi, functionName: "market", args: [m] })
  const high = await h.fork.client.readContract({ address: lens, abi: marketLensAbi, functionName: "account", args: [m, past] })
  expect(high.liquidatable, `ltv ${high.ltvBps} threshold ${market.liquidationThresholdBps} price ${market.priceE18}`).toBe(true)
  await page.setViewportSize(viewports.wide)
  await start(page, useFork, "#loans")
  const highRow = page.locator(`[data-row="loan"][data-borrower="${past.toLowerCase()}"]:visible`)
  await expect(highRow).toBeVisible({ timeout: 60_000 })
  await expect(highRow.locator('[data-value="distance"]')).toHaveText(`past the line by ${(Number(high.ltvBps - market.liquidationThresholdBps) / 100).toFixed(2)} pts`)
  await expect(highRow.locator('[data-value="fall"]')).toContainText(/liquidatable now · price already [\d.]+% below its liquidation price/)
  expect(await page.getByTestId("risk-console").innerText()).not.toMatch(/−-|--|−−|-−/)
})
