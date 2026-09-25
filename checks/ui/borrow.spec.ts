/**
 * Borrow screen on a fork of X Layer: the burner deposits NVDAx (approve + deposit) and borrows within the session
 * limit; the harness jumps to Saturday and the keeper posts CLOSED; a further borrow is refused before signing with
 * the contract's own SessionLimit error (nothing sent); repay and withdraw still go through.
 * Run: npx playwright test checks/ui/borrow.spec.ts
 */
import { mkdirSync } from "node:fs"
import { formatUnits, parseUnits, type Address } from "viem"
import { collateralMarketAbi, marketLensAbi } from "@intatto/config/abi"
import { REFUSALS, sessionFromIndex } from "@intatto/config/session"
import type { Page } from "@playwright/test"
import { expect, expectNoHorizontalScroll, test, viewports } from "./fixtures"
import { startForkHarness, type ForkHarness } from "../fork/harness.ts"
import { weekend } from "../fork/lib/scenarios.ts"

type LensAccount = {
  shares: bigint
  assets: bigint
  valueUsdg: bigint
  debt: bigint
  ltvBps: bigint
  borrowCapacity: bigint
  walletToken: bigint
  walletUsdg: bigint
}

/** Formats like the UI: truncated (never rounded) to `digits` decimals, thousands grouped. */
function fixed(x: bigint, decimals: number, digits: number) {
  const [i = "0", f = ""] = formatUnits(x, decimals).split(".")
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f.slice(0, digits).padEnd(digits, "0")}`
}
const usdg = (x: bigint) => `${fixed(x, 6, 2)} USDG`
const pct = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`
/** Lens capacity as Borrow prints it: all 6 USDG decimals. */
const capacityText = (x: bigint) => `${fixed(x, 6, 6)} USDG`
/** The drop (bps, rounded up) at which the position's LTV reaches the 65% liquidation threshold. */
function liquidationLine(a: LensAccount): string {
  const keep = (a.debt * 10_000n * 1_000_000n) / (a.valueUsdg * 6_500n)
  const bps = ((1_000_000n - keep) * 10_000n + 999_999n) / 1_000_000n
  return `−${(Number(bps) / 100).toFixed(bps % 100n === 0n ? 0 : 2)}%`
}

let h: ForkHarness
test.describe.configure({ mode: "serial" })
// Other checks run concurrently and clean the shared checks/ui/.results at start, deleting in-flight trace files.
test.use({ trace: "off" })

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(300_000)
  h = await startForkHarness()
  mkdirSync("proof", { recursive: true })
})

test.afterAll(async () => {
  await h?.stop()
})

/** Full-page shots start from the top so the sticky header is not captured mid-page. */
async function shoot(page: Page, path: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path, fullPage: true })
}

async function shootAllWidths(page: Page, name: string) {
  await shoot(page, `proof/${name}.png`)
  for (const [key, size] of [["768", viewports.medium], ["390", viewports.narrow]] as const) {
    await page.setViewportSize(size)
    await page.waitForTimeout(400)
    await expectNoHorizontalScroll(page)
    await shoot(page, `proof/${name}-${key}.png`)
  }
  await page.setViewportSize(viewports.wide)
}

test("deposit and borrow, refused before signing on the weekend, repay and withdraw always work", async ({ page, useFork }) => {
  test.setTimeout(600_000)
  const d = h.deployment
  const m = d.markets.find((x) => x.symbol === "NVDAx")!
  const market = m.market as Address
  const burner = h.env.burnerAddress
  const read = <T>(to: string, abi: never, fn: string, args: unknown[] = []) => h.fork.read<T>(to as Address, abi, fn, args)
  const account = () => read<LensAccount>(d.lens, marketLensAbi as never, "account", [market, burner])

  await useFork(page, h.env)
  await page.setViewportSize(viewports.wide)
  await page.goto("/borrow")

  // ── Empty state: market read from the chain, no position yet ──
  const lensMarket = await read<{ session: number; maxLtvBps: bigint; priceE18: bigint }>(d.lens, marketLensAbi as never, "market", [market])
  const startSession = sessionFromIndex(Number(lensMarket.session))
  expect(["OPEN", "EXTENDED"]).toContain(startSession)
  await expect(page.getByTestId("borrow-screen")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId("session-badge")).toHaveText(startSession)
  await expect(page.getByTestId("market-select")).toContainText("NVDAx")
  await expect(page.getByTestId("relayed-price")).toHaveText(`$${fixed(lensMarket.priceE18, 18, 2)}`)
  await expect(page.getByTestId("session-max-ltv")).toHaveText(pct(lensMarket.maxLtvBps))
  await expect(page.getByTestId("position-empty")).toBeVisible({ timeout: 60_000 })
  const form = page.getByTestId("deposit-borrow-form")
  const formCta = form.locator('[data-slot="form-cta"] button')
  await expect(formCta).toHaveText("Enter an amount")
  await expect(formCta).toBeDisabled()
  await expectNoHorizontalScroll(page)

  // ── Collateral Max → loan preset chip at the Medium risk level ──
  const start = await account()
  await form.locator('[data-slot="amount-input"]').first().getByRole("button", { name: "Max" }).click()
  await expect(page.locator("#borrow-collateral")).toHaveValue(formatUnits(start.walletToken, 18))
  await page.getByRole("button", { name: /^Medium risk/ }).click()
  const loan = parseUnits(await page.locator("#borrow-loan").inputValue(), 6)
  expect(loan).toBeGreaterThan(0n)
  await expect(page.getByTestId("loan-line")).toContainText("Medium")
  await expect(page.getByTestId("position-debt")).toContainText(usdg(loan))
  await expect(formCta).toHaveText("Review")

  // ── Review → approve NVDAx → deposit → borrow ──
  await formCta.click()
  const review = page.getByTestId("borrow-review")
  await expect(review.getByTestId("review-preview")).toContainText(usdg(loan))
  await review.getByRole("button", { name: "Approve NVDAx" }).click({ timeout: 60_000 })
  await review.getByRole("button", { name: /^Deposit / }).click({ timeout: 60_000 })
  await expect(review.getByTestId("review-done-step").first()).toContainText("Deposited", { timeout: 60_000 })
  const afterDeposit = await account()
  expect(afterDeposit.shares).toBeGreaterThan(0n)
  // NVDAx balances derive from a multiplier, so moving the whole balance can leave a wei of rounding dust.
  expect(afterDeposit.walletToken).toBeLessThan(10n)
  await review.getByRole("button", { name: `Borrow ${usdg(loan)}` }).click({ timeout: 60_000 })
  await expect(review.getByTestId("review-finished")).toBeVisible({ timeout: 60_000 })
  await expect(review.getByTestId("review-done-step")).toHaveCount(2)

  const borrowed = await account()
  expect(borrowed.debt).toBeGreaterThanOrEqual(loan)
  expect(borrowed.walletUsdg).toBe(start.walletUsdg + loan)
  // Displayed debt, LTV and collateral equal the contract's own reads.
  await expect.poll(async () => (await page.getByTestId("position-debt").innerText()).includes(usdg((await account()).debt)), { timeout: 30_000 }).toBe(true)
  await expect.poll(async () => (await page.getByTestId("position-ltv").innerText()).includes(pct((await account()).ltvBps)), { timeout: 30_000 }).toBe(true)
  await expect(page.getByTestId("position-shares")).toContainText(`${fixed(borrowed.shares, 18, 4).replace(/0+$/, "").replace(/\.$/, "")} wNVDAx`)
  // The Monday-gap table has this position's exact liquidation line and lender loss.
  await expect(page.getByTestId("gap-table")).toBeVisible()
  await expect(page.getByTestId("gap-line").filter({ visible: true })).toContainText(liquidationLine(await account()))
  await expect(page.getByTestId("gap-line").filter({ visible: true })).toContainText("Liquidation starts")
  await expect(page.getByTestId("gap-table")).toContainText("Lenders lose (est.)")
  await expect(page.getByTestId("gap-note")).toContainText("estimate at the oracle price with no slippage")
  await shoot(page, "proof/borrow-borrowed.png")

  // ── Saturday: the keeper posts CLOSED; the screen follows without a reload ──
  await review.getByRole("button", { name: "Back to the form" }).click()
  // "Can borrow" and the Max hint are the lens borrowCapacity, all 6 USDG decimals.
  const loanField = form.locator('[data-slot="amount-input"]').nth(1)
  await expect.poll(async () => {
    const cap = capacityText((await account()).borrowCapacity)
    const text = await loanField.innerText()
    const title = await loanField.getByRole("button", { name: "Max" }).getAttribute("title")
    return text.includes(`Can borrow ${cap}`) && title === `Borrow ${cap}`
  }, { timeout: 30_000 }).toBe(true)
  await weekend(h.ctx)
  await expect(page.getByTestId("session-badge")).toHaveText("CLOSED", { timeout: 45_000 })
  const closed = await read<{ maxLtvBps: bigint }>(d.lens, marketLensAbi as never, "market", [market])
  await expect(page.getByTestId("session-max-ltv")).toHaveText(pct(closed.maxLtvBps))
  expect((await account()).ltvBps).toBeGreaterThan(closed.maxLtvBps)
  // No room under the CLOSED limit: capacity reads 0 and the chips and Max are disabled with the reason.
  expect((await account()).borrowCapacity).toBe(0n)
  await expect(page.getByTestId("loan-refused-now")).toContainText("Maximum borrowable exceeded for the CLOSED session", { timeout: 45_000 })
  await expect(loanField).toContainText(`Can borrow ${capacityText(0n)}`)
  await expect(page.getByRole("button", { name: /^Max, unavailable/ })).toBeDisabled()
  for (const chip of await page.getByRole("button", { name: /risk: borrow/ }).all()) await expect(chip).toBeDisabled()

  // ── A further borrow is refused before signing, by the contract's own simulation ──
  const nonceBefore = await h.fork.client.getTransactionCount({ address: burner })
  await page.locator("#borrow-loan").fill("10")
  await expect(formCta).toHaveText("Refused: SessionLimit", { timeout: 45_000 })
  await expect(formCta).toBeDisabled()
  await expect(form).toContainText(REFUSALS.SessionLimit)
  await expect(form).toContainText("Maximum borrowable exceeded for the CLOSED session")
  await expect(form).toContainText("Nothing was signed or sent")
  await expect(form).toContainText(`You can borrow up to ${capacityText(0n)} now`)
  const simulated = await h.fork.client
    .simulateContract({ address: market, abi: collateralMarketAbi, functionName: "borrow", args: [10_000_000n], account: burner })
    .then(() => "accepted", (e: Error) => e.message)
  expect(simulated).toContain("SessionLimit")
  expect(await h.fork.client.getTransactionCount({ address: burner })).toBe(nonceBefore)
  await shootAllWidths(page, "borrow")

  // ── Repay in the CLOSED session: Max = min(wallet, debt) → approve USDG → repay everything ──
  await page.locator("#borrow-loan").fill("")
  await page.getByRole("tab", { name: "Repay & withdraw" }).click()
  const rform = page.getByTestId("repay-withdraw-form")
  await expect(rform).toContainText("Repaying never depends on the price or the market session")
  await rform.locator('[data-slot="amount-input"]').first().getByRole("button", { name: "Max" }).click()
  await expect(rform).toContainText("Repays the whole loan")
  const rCta = rform.locator('[data-slot="form-cta"] button')
  await expect(rCta).toHaveText("Review")
  await rCta.click()
  const rreview = page.getByTestId("repay-review")
  await rreview.getByRole("button", { name: "Approve USDG" }).click({ timeout: 60_000 })
  await rreview.getByRole("button", { name: "Repay the whole loan" }).click({ timeout: 60_000 })
  await expect(rreview.getByTestId("review-finished")).toContainText("fully repaid", { timeout: 60_000 })
  const repaid = await account()
  expect(repaid.debt).toBe(0n)
  await expect(page.getByTestId("position-debt")).toContainText(usdg(0n))
  await expect(page.getByTestId("position-ltv")).toContainText(pct(0n))
  await shoot(page, "proof/borrow-repaid.png")

  // ── With no debt, everything can be withdrawn even while CLOSED; it comes back as NVDAx ──
  await rreview.getByRole("button", { name: "Back to the form" }).click()
  await rform.locator('[data-slot="amount-input"]').nth(1).getByRole("button", { name: "Max" }).click()
  await rCta.click()
  await rreview.getByRole("button", { name: /^Withdraw / }).click({ timeout: 60_000 })
  await expect(rreview.getByTestId("review-finished")).toBeVisible({ timeout: 60_000 })
  const out = await account()
  expect(out.shares).toBe(0n)
  expect(out.walletToken).toBeGreaterThan(0n)
})
