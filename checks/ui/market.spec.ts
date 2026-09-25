/**
 * Market screen (pg_market, route "/") on a fork of X Layer with NVDAx and SPYx deployed. The page is read in three
 * session states the keeper posts (the fork's own EXTENDED, OPEN after moving to regular hours with a borrower at the
 * weekday limit, CLOSED after the weekend scenario); every displayed session, max LTV, price, fetch time and guard
 * result must equal a contract read, and so must the headline numbers (gap reserve and recognised deficits too) and the
 * burner's "Can borrow now" (MarketLens.account borrowCapacity, or 0 with the reason when a borrow is refused). Then
 * SPYx (no price posted) behind the borrowing-off toggle with ?market=SPYx links, phone/tablet layouts, an RPC failure
 * and the not-deployed live state. Amounts are formatted by the page's own helpers (web/components/market/format.ts).
 */
import { mkdirSync } from "node:fs"
import type { Locator, Page } from "@playwright/test"
import type { Address } from "viem"
import {
  collateralMarketAbi,
  corporateActionGuardAbi,
  marketLensAbi,
  priceRelayAdapterAbi,
  sessionRiskControllerAbi,
} from "@intatto/config/abi"
import { SESSIONS } from "@intatto/config/session"
import { test, expect, viewports, expectNoHorizontalScroll } from "./fixtures"
import { startForkHarness, type ForkHarness } from "../fork/harness.ts"
import { erc20, market as marketAbi } from "../fork/lib/abis.ts"
import { openAtWeekdayLimit, weekend } from "../fork/lib/scenarios.ts"
import { bps, usdPrice as usd, usdg, usdgExact } from "../../web/components/market/format.ts"

test.describe.configure({ mode: "serial" })

type Symbol = "NVDAx" | "SPYx"
type LensMarket = { totalDebt: bigint; totalCollateralValue: bigint; capUsdg: bigint }
type LensVault = { idle: bigint; totalAssets: bigint; utilizationBps: bigint; reserveBalance: bigint; totalDeficit: bigint; deficitCount: bigint }
type LensAccount = { valueUsdg: bigint; borrowCapacity: bigint }

const BORROWER: Address = "0x000000000000000000000000000000000000ba5e"
const utc = (t: bigint | number) => `${new Date(Number(t) * 1000).toISOString().slice(0, 19).replace("T", " ")} UTC`

let h: ForkHarness

const mkt = (s: Symbol) => h.deployment.markets.find((m) => m.symbol === s)!
const lensMarket = (s: Symbol) => h.fork.read<LensMarket>(h.deployment.lens as Address, marketLensAbi, "market", [mkt(s).market])
const lensVault = () => h.fork.read<LensVault>(h.deployment.lens as Address, marketLensAbi, "vault", [mkt("NVDAx").market])
const lensAccount = (s: Symbol) =>
  h.fork.read<LensAccount>(h.deployment.lens as Address, marketLensAbi, "account", [mkt(s).market, h.env.burnerAddress])
const sessionRead = <T>(fn: string) => h.fork.read<T>(h.deployment.sessionRisk as Address, sessionRiskControllerAbi, fn)
const latestPrice = (s: Symbol) => h.fork.read<[bigint, bigint]>(mkt(s).priceRelay as Address, priceRelayAdapterAbi, "latestPrice")

/** Each guard straight from the contract that owns it (not through MarketLens). */
async function guardReads(s: Symbol): Promise<Record<string, boolean>> {
  const m = mkt(s)
  const g = await h.fork.read<{ fresh: boolean; inBand: boolean; pegOk: boolean }>(m.priceRelay as Address, priceRelayAdapterAbi, "guardStatus")
  const caPaused = await h.fork.read<boolean>(m.corporateActionGuard as Address, corporateActionGuardAbi, "isPaused")
  const issuerPaused = await h.fork.read<boolean>(m.market as Address, collateralMarketAbi, "issuerPaused")
  return { fresh: g.fresh, inBand: g.inBand, pegOk: g.pegOk, corporateAction: !caPaused, issuerPause: !issuerPaused }
}

/** Polls until what the page shows equals a fresh contract read (both re-read every round, so ticks cannot race). */
async function shows(what: string, ui: () => Promise<string | null>, chain: () => Promise<string>) {
  await expect
    .poll(
      async () => {
        const [u, c] = [(await ui())?.trim() ?? null, await chain()]
        return u === c ? "match" : `page "${u}" vs chain "${c}"`
      },
      { message: what, timeout: 60_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe("match")
}

async function expectDetailEqualsChain(page: Page, s: Symbol) {
  const d = page.getByTestId(`market-detail-${s}`)
  await expect(d).toBeVisible({ timeout: 60_000 })
  await shows(`${s} session`, () => d.getByTestId("session-value").getAttribute("data-session"), async () => SESSIONS[Number(await sessionRead<number>("currentSession"))]!)
  await shows(`${s} max LTV tile`, () => d.getByTestId("tile-max-ltv").locator("[data-slot=value]").textContent(), async () => bps(await sessionRead<bigint>("maxLtvBps")))
  await shows(`${s} price`, () => d.getByTestId("price-value").textContent(), async () => {
    const [p] = await latestPrice(s)
    return p === 0n ? "No price posted yet" : usd(p)
  })
  const [price] = await latestPrice(s)
  if (price > 0n) {
    await shows(`${s} fetched time`, () => d.getByTestId("price-fetched-at").textContent(), async () => utc((await latestPrice(s))[1]))
  }
  for (const key of ["fresh", "inBand", "pegOk", "corporateAction", "issuerPause"]) {
    await shows(`${s} guard ${key}`, () => d.getByTestId(`guard-${key}`).getAttribute("data-ok"), async () => String((await guardReads(s))[key]))
  }
}

async function expectHeadlineEqualsChain(page: Page) {
  const stat = (id: string): Promise<string | null> => page.getByTestId(`stat-${id}`).locator("[data-slot=value]").textContent()
  const markets = () => Promise.all(h.deployment.markets.map((m) => lensMarket(m.symbol)))
  await shows("total deposits", () => stat("deposits"), async () => usdg((await lensVault()).totalAssets))
  await shows("loans", () => stat("loans"), async () => usdg((await markets()).reduce((a, m) => a + m.totalDebt, 0n)))
  await shows("available", () => stat("available"), async () => usdg((await lensVault()).idle))
  await shows("collateral value", () => stat("collateral"), async () => usdg((await markets()).reduce((a, m) => a + m.totalCollateralValue, 0n)))
  await shows("utilisation", () => stat("utilisation"), async () => bps((await lensVault()).utilizationBps))
  await shows("gap reserve", () => stat("reserve"), async () => usdg((await lensVault()).reserveBalance))
  await shows("recognised deficits", () => stat("deficits"), async () => usdg((await lensVault()).totalDeficit))
  await shows("deficit count", () => page.getByTestId("deficit-count").textContent(), async () => `${(await lensVault()).deficitCount} recorded`)
  await expect(page.getByTestId("waterfall-line").getByRole("link", { name: "How losses are covered" })).toHaveAttribute("href", "/lend#risk")
}

/** "Can borrow now" equals MarketLens.account(...).borrowCapacity to the last digit, or 0 with a reason when refused. */
async function expectCapacity(page: Page, s: Symbol, refused: boolean) {
  const info = page.getByTestId("your-info-connected")
  await expect(info).toBeVisible({ timeout: 60_000 })
  await shows(`${s} can borrow now`, () => info.getByTestId("borrow-capacity").textContent(), async () =>
    usdgExact(refused ? 0n : (await lensAccount(s)).borrowCapacity),
  )
  await expect(info.getByTestId("borrow-capacity-reason")).toHaveCount(refused ? 1 : 0)
}

/** The burner adds 1 NVDAx and borrows `ltvBps` of its value, straight on the fork (the Borrow screen is not under test). */
async function burnerBorrows(ltvBps: bigint) {
  const m = mkt("NVDAx")
  const who = h.env.burnerAddress
  await h.fork.write(who, m.token as Address, erc20, "approve", [m.market, 10n ** 18n])
  await h.fork.write(who, m.market as Address, marketAbi, "addCollateral", [10n ** 18n])
  const { valueUsdg } = await lensAccount("NVDAx")
  await h.fork.write(who, m.market as Address, marketAbi, "borrow", [(valueUsdg * ltvBps) / 10_000n])
}

async function openChip(page: Page, id: string): Promise<Locator> {
  await page.keyboard.press("Escape")
  await page.getByTestId(id).getByRole("button").click()
  const tip = page.getByTestId(`${id}-tooltip`)
  await expect(tip).toBeVisible()
  return tip
}

/** Escape only after the sheet owns focus. An earlier keypress hits the trigger and leaves the dialog open. */
async function escapeOpenDialog(page: Page) {
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect.poll(() =>
    page.evaluate(() => {
      const active = document.activeElement
      const open = document.querySelector("[role=dialog]")
      return Boolean(active && open && (open === active || open.contains(active)))
    }),
  ).toBe(true)
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
}

/** Full-page proof from the top once nothing is still loading (a scrolled page paints the sticky nav mid-image). */
async function proof(page: Page, path: string) {
  await expect(page.locator("main [data-slot=skeleton]")).toHaveCount(0, { timeout: 60_000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path, fullPage: true })
}

async function openMarket(page: Page) {
  await page.goto("/")
  await expect(page.getByTestId("headline-stats")).toBeVisible({ timeout: 180_000 })
}

test.beforeAll(async () => {
  test.setTimeout(300_000)
  h = await startForkHarness({ spyx: true })
  mkdirSync("proof", { recursive: true })
})

test.afterAll(async () => {
  await h?.stop()
})

test("not deployed on X Layer: the screen says so and points to the sandbox", async ({ page }) => {
  test.skip(Boolean(process.env.NEXT_PUBLIC_LIVE_DEPLOYMENT), "a live deployment is configured")
  test.setTimeout(180_000)
  await page.goto("/")
  await expect(page.getByTestId("market-not-deployed")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole("link", { name: "Try the sandbox" })).toHaveAttribute("href", "/sandbox")
})

test("RPC failure: an error with a retry instead of numbers", async ({ page, useFork }) => {
  test.setTimeout(180_000)
  await useFork(page, { ...h.env, rpcUrl: "http://127.0.0.1:9" })
  await page.goto("/")
  await expect(page.getByTestId("market-load-error")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible()
})

test("three keeper sessions: session, max LTV, price, fetch time and guards equal contract reads", async ({ page, useFork }) => {
  test.setTimeout(600_000)
  await page.setViewportSize(viewports.wide)
  await useFork(page, h.env)
  await openMarket(page)

  // 1. The session the harness's keeper tick posted at the fork's own time.
  const first = SESSIONS[Number(await sessionRead<number>("currentSession"))]!
  await expectDetailEqualsChain(page, "NVDAx")
  await expectHeadlineEqualsChain(page)
  await shows("NVDAx row max LTV", () => page.getByTestId("row-max-ltv-NVDAx").textContent(), async () => bps(await sessionRead<bigint>("maxLtvBps")))
  const [, fetchedAt] = await latestPrice("NVDAx")
  await expect(await openChip(page, "chip-price")).toContainText(`Fetched by the keeper at ${utc(fetchedAt)}`)
  await page.keyboard.press("Escape")
  const aboutRelay = page.getByTestId("chip-relay").getByRole("button", { name: "About Relay" })
  await aboutRelay.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("chip-relay-tooltip")).toContainText("trusted relayer, bounded onchain by keeper liveness")
  await page.keyboard.press("Escape")
  await expect(aboutRelay).toBeFocused()
  await expect(await openChip(page, "chip-liquidation")).toContainText("bounded slices while the market is closed")
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("your-info-connected")).toBeVisible({ timeout: 60_000 })
  await shows("burner USDG", () => page.getByTestId("wallet-usdg").textContent(), async () =>
    usdg(await h.fork.read<bigint>(h.deployment.usdg as Address, erc20, "balanceOf", [h.env.burnerAddress])),
  )
  await expectNoHorizontalScroll(page)
  await proof(page, `proof/market-${first.toLowerCase()}.png`)

  // 2. Regular hours, with a borrower at the weekday limit so loans, collateral and cap usage are non-zero.
  await openAtWeekdayLimit(h.ctx, BORROWER, 5n * 10n ** 18n)
  expect(SESSIONS[Number(await sessionRead<number>("currentSession"))]).toBe("OPEN")
  await expectDetailEqualsChain(page, "NVDAx")
  await expectHeadlineEqualsChain(page)
  await shows("cap usage", () => page.getByTestId("cap-used").textContent(), async () => {
    const m = await lensMarket("NVDAx")
    return bps(m.capUsdg === 0n ? 0n : (m.totalDebt * 10_000n) / m.capUsdg)
  })
  await expect(page.getByTestId("tile-max-ltv").locator("[data-slot=value]")).toHaveText("50.00%")
  await burnerBorrows(3_600n)
  await expectCapacity(page, "NVDAx", false)
  // The shared risk scale: 36% LTV is Medium (from 30%), whatever the session limit.
  await expect(page.getByTestId("your-info").locator("[data-slot=risk-meter]")).toContainText("Medium")
  await expect(page.getByTestId("market-row-NVDAx").getByRole("link", { name: "Add collateral" })).toHaveAttribute("href", "/borrow?market=NVDAx")
  await expect(page.getByTestId("guards-risk-link")).toHaveAttribute("href", "/risk")
  await expect(page.getByTestId("price-risk-link")).toHaveAttribute("href", "/risk")
  await proof(page, "proof/market-open.png")

  // 3. The weekend: the keeper posts CLOSED and the limit for new loans starts stepping down.
  await weekend(h.ctx)
  expect(SESSIONS[Number(await sessionRead<number>("currentSession"))]).toBe("CLOSED")
  await expectDetailEqualsChain(page, "NVDAx")
  await expectHeadlineEqualsChain(page)
  await expect(page.getByTestId("session-meaning")).toContainText("The US stock market is closed")
  await expect(page.getByTestId("borrowing-off")).toHaveCount(0)
  await expectCapacity(page, "NVDAx", false)
  const [, closedFetchedAt] = await latestPrice("NVDAx")
  await expect(await openChip(page, "chip-price")).toContainText(`Fetched by the keeper at ${utc(closedFetchedAt)}`)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "View price history" }).click()
  await expect(page.getByTestId("price-posts").locator("li").first()).toContainText(utc(closedFetchedAt))
  await page.keyboard.press("Escape")
  const schedule = page.getByTestId("session-schedule")
  await schedule.locator("summary").focus()
  await page.keyboard.press("Enter")
  await expect(schedule).toHaveJSProperty("open", true)
  await schedule.locator("summary").press("Enter")
  await expect(schedule).toHaveJSProperty("open", false)
  const keeperRecords = page.getByRole("button", { name: "View keeper records" })
  await keeperRecords.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("keeper-records-sheet")).toBeVisible()
  await escapeOpenDialog(page)
  await expect(keeperRecords).toBeFocused()
  const contracts = page.getByRole("button", { name: "Contracts" })
  await contracts.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("contracts-sheet")).toBeVisible()
  await escapeOpenDialog(page)
  await expect(contracts).toBeFocused()
  await expectNoHorizontalScroll(page)
  await proof(page, "proof/market.png")

  // 4. SPYx has no price posted: it sits behind the borrowing-off toggle and every failing guard matches the chain.
  await expect(page.getByTestId("market-row-SPYx")).toHaveCount(0)
  await expect(page.getByTestId("markets-count")).toHaveText("Showing 1 of 2 stock markets")
  await page.getByLabel("Show markets where borrowing is off (1)").click()
  await expect(page.getByTestId("markets-off")).toContainText("New borrowing is off in this market right now")
  await page.getByTestId("market-row-SPYx").getByRole("button").click()
  await expectDetailEqualsChain(page, "SPYx")
  await expect(page.getByTestId("market-detail-SPYx").getByTestId("borrowing-off")).toContainText("repaying and adding collateral still work")
  await expect(page.getByTestId("chip-price")).toContainText("not posted")
  await expectCapacity(page, "SPYx", true)
  await expect(page.getByTestId("borrow-capacity-reason")).toHaveText("No price has been posted for this market yet, so new borrowing is off.")
  await expect(page.getByTestId("market-row-SPYx").getByRole("link", { name: "Add collateral" })).toHaveAttribute("href", "/borrow?market=SPYx")
  await expect(page.getByTestId("market-detail-SPYx").getByRole("link", { name: "Borrow USDG" }).first()).toHaveAttribute("href", "/borrow?market=SPYx")
  await proof(page, "proof/market-spyx.png")
})

test("phones and tablets: markets become cards, Overview / Your info tabs, no sideways scroll", async ({ page, useFork }) => {
  test.setTimeout(300_000)
  await useFork(page, h.env)
  for (const [name, size] of [["390", viewports.narrow], ["768", viewports.medium]] as const) {
    await page.setViewportSize(size)
    await openMarket(page)
    await expectDetailEqualsChain(page, "NVDAx")
    await expectNoHorizontalScroll(page)
    // Rows are cards: each value carries its own label and the table header is gone.
    await expect(page.getByTestId("market-row-NVDAx").getByText("Collateral supplied")).toBeVisible()
    await expect(page.getByTestId("tab-you")).toBeHidden()
    await page.getByRole("tab", { name: "Your info" }).click()
    await expect(page.getByTestId("your-info")).toBeVisible()
    await expect(page.getByTestId("tab-overview")).toBeHidden()
    await expectNoHorizontalScroll(page)
    await page.getByRole("tab", { name: "Overview" }).click()
    await expect(page.getByTestId("session-panel")).toBeVisible()
    await proof(page, `proof/market-${name}.png`)
  }
})
