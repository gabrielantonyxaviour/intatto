/**
 * Market screen (pg_market, route "/") on a fork of X Layer with NVDAx and SPYx deployed. The page is read in three
 * session states the keeper posts (the fork's own EXTENDED, OPEN after moving to regular hours with a borrower at the
 * weekday limit, CLOSED after the weekend scenario); every displayed session, max LTV, price, fetch time and guard
 * result must equal a contract read. Then the SPYx market (no price posted) behind the borrowing-off toggle, the
 * phone/tablet layouts, an RPC failure and the not-deployed live state.
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
import { erc20 } from "../fork/lib/abis.ts"
import { openAtWeekdayLimit, weekend } from "../fork/lib/scenarios.ts"
import { formatTokenAmount } from "../../web/components/ui/web3/format.ts"

test.describe.configure({ mode: "serial" })

type Symbol = "NVDAx" | "SPYx"
type LensMarket = { totalDebt: bigint; totalCollateralValue: bigint; capUsdg: bigint }
type LensVault = { idle: bigint; totalAssets: bigint; utilizationBps: bigint }

const BORROWER: Address = "0x000000000000000000000000000000000000ba5e"
const usdg = (v: bigint) => `${formatTokenAmount(v, 6, { maxFractionDigits: 2, minFractionDigits: 2 })} USDG`
const usd = (v: bigint) => `$${formatTokenAmount(v, 18, { maxFractionDigits: 2, minFractionDigits: 2 })}`
const bps = (v: bigint) => `${(Number(v) / 100).toFixed(2)}%`
const utc = (t: bigint | number) => `${new Date(Number(t) * 1000).toISOString().slice(0, 19).replace("T", " ")} UTC`

let h: ForkHarness

const mkt = (s: Symbol) => h.deployment.markets.find((m) => m.symbol === s)!
const lensMarket = (s: Symbol) => h.fork.read<LensMarket>(h.deployment.lens as Address, marketLensAbi, "market", [mkt(s).market])
const lensVault = () => h.fork.read<LensVault>(h.deployment.lens as Address, marketLensAbi, "vault", [mkt("NVDAx").market])
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
}

async function hoverChip(page: Page, id: string): Promise<Locator> {
  // Leave any open tooltip first, in several pointer moves like a real mouse: Radix closes a tooltip from a
  // document pointermove after the pointer leaves its hover grace area, so a single jump is never seen.
  await page.mouse.move(0, 0, { steps: 8 })
  await expect(page.getByRole("tooltip")).toHaveCount(0)
  await page.getByTestId(id).hover()
  const tip = page.getByTestId(`${id}-tooltip`)
  await expect(tip).toBeVisible()
  return tip
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
  await expect(await hoverChip(page, "chip-price")).toContainText(`Fetched by the keeper at ${utc(fetchedAt)}`)
  await expect(await hoverChip(page, "chip-relay")).toContainText("trusted relayer, bounded onchain by keeper liveness")
  await expect(await hoverChip(page, "chip-liquidation")).toContainText("bounded slices while the market is closed")
  await page.mouse.move(0, 0, { steps: 8 })
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
  await proof(page, "proof/market-open.png")

  // 3. The weekend: the keeper posts CLOSED and the limit for new loans starts stepping down.
  await weekend(h.ctx)
  expect(SESSIONS[Number(await sessionRead<number>("currentSession"))]).toBe("CLOSED")
  await expectDetailEqualsChain(page, "NVDAx")
  await expectHeadlineEqualsChain(page)
  await expect(page.getByTestId("session-meaning")).toContainText("The US stock market is closed")
  await expect(page.getByTestId("borrowing-off")).toHaveCount(0)
  const [, closedFetchedAt] = await latestPrice("NVDAx")
  await expect(await hoverChip(page, "chip-price")).toContainText(`Fetched by the keeper at ${utc(closedFetchedAt)}`)
  await expect(page.getByTestId("price-posts").locator("li").first()).toContainText(utc(closedFetchedAt))
  await page.mouse.move(0, 0, { steps: 8 })
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
  await expect(page.getByTestId("your-info-connected")).toBeVisible({ timeout: 60_000 })
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
