/** Lend screen on a fork: primer, deposit, withdraw, idle limit, then a recognised deficit and a lower share price. */
import { mkdirSync, readFileSync } from "node:fs"
import type { Page } from "@playwright/test"
import { decodeEventLog, type Address, type Hex } from "viem"
import { lendingVaultAbi, marketLensAbi } from "@intatto/config/abi"
import { test, expect, viewports, expectNoHorizontalScroll } from "./fixtures"
import { startForkHarness, SANDBOX_LENDER, type ForkHarness } from "../fork/harness.ts"
import * as scenarios from "../fork/lib/scenarios.ts"
import { formatTokenAmount } from "../../web/components/ui/web3/format.ts"
import { bpsText, lossExample, usdg } from "../../web/components/lend/lend-format.ts"

test.describe.configure({ mode: "serial" })
test.use({ trace: "off" })

const bps = (v: bigint) => `${(Number(v) / 100).toFixed(2)}%`
const REPLAYS = new URL("../../data/replays/", import.meta.url)
const replay = (name: string) => JSON.parse(readFileSync(new URL(name, REPLAYS), "utf8"))
const LENDER_GAS = 1_500_000n
const BORROWER: Address = "0x0000000000000000000000000000000000005ce7"

let h: ForkHarness
let vault: Address
let burner: Address

async function lensVault() {
  const m = h.deployment.markets[0]!
  return h.fork.read<{ supplyRateBps: bigint; reserveBalance: bigint; idle: bigint; totalAssets: bigint }>(
    h.deployment.lens as Address, marketLensAbi, "vault", [m.market],
  )
}
const readVault = <T>(fn: string, args: unknown[] = []) => h.fork.read<T>(vault, lendingVaultAbi, fn, args)

async function printChainTail() {
  const latest = await h.fork.client.getBlockNumber()
  const rows: string[] = []
  for (let n = latest - 25n; n <= latest; n++) {
    const blk = await h.fork.client.getBlock({ blockNumber: n })
    rows.push(`${n}:${blk.timestamp}:${blk.transactions.length}`)
  }
  const ledger = h.fork.ledger.entries.slice(-14).map((x) => [x.kind, x.summary.slice(0, 70), x.chainTime, x.detail])
  console.info(`[lend] blocks ${rows.join(" ")}\n[lend] ledger ${JSON.stringify(ledger)}`)
}

async function clearToasts(page: Page) {
  await page.mouse.move(1, 1)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 20_000 })
}

async function acceptTerms(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem("intatto:lend-terms:v1", "accepted") } catch { /* opaque origin */ }
  })
}

/** Focus a disclosure and open it from the keyboard. */
async function keyOpen(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).focus()
  await page.keyboard.press("Enter")
}

test.beforeAll(async () => {
  test.setTimeout(300_000)
  h = await startForkHarness()
  vault = h.deployment.vault as Address
  burner = h.env.burnerAddress
  mkdirSync("proof", { recursive: true })
})

test.afterAll(async () => { await h?.stop() })

test("small amounts keep their digits and the loss example never states more than 100%", () => {
  expect(usdg(1_497_500n, 0)).toBe("1.4975 USDG")
  expect(usdg(1_497_502n)).toBe("1.4975 USDG")
  expect(usdg(400_000n)).toBe("0.40 USDG")
  expect(usdg(150_500_000n, 0)).toBe("150.5 USDG")
  expect(usdg(50_150_000_000n, 0)).toBe("50,150 USDG")
  expect(lossExample(1_497_500n)).toBe("The vault holds 1.4975 USDG today, so a write-off that size would wipe out all deposits.")
  expect(lossExample(50_150_000_000n)).toContain("by 1.994% at today's deposits")
  for (const total of [0n, 1n, 1_497_500n, 999_999_999n, 1_000_000_000n, 1_000_000_001n, 50_150_000_000n, 10n ** 18n]) {
    for (const m of lossExample(total).matchAll(/([\d.,]+)%/g)) {
      expect(Number(m[1]!.replace(/,/g, "")), lossExample(total)).toBeLessThanOrEqual(100)
    }
  }
})

test("not deployed on X Layer: the screen points to the sandbox", async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto("/lend")
  await expect(page.getByTestId("lend-not-deployed")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole("link", { name: "Open the sandbox" })).toHaveAttribute("href", "/sandbox")
})

test("RPC failure: an error with a retry, not a blank page", async ({ page, useFork }) => {
  test.setTimeout(180_000)
  await useFork(page, { ...h.env, rpcUrl: "http://127.0.0.1:9" })
  await page.goto("/lend")
  await expect(page.getByTestId("lend-error")).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
})

test("a burner reads the primer, deposits and withdraws USDG through the UI", async ({ page, useFork }) => {
  test.setTimeout(300_000)
  await page.setViewportSize(viewports.wide)
  await useFork(page, h.env)
  await page.goto("/lend")

  const primer = page.getByTestId("lend-primer")
  await expect(primer).toBeVisible({ timeout: 120_000 })
  const proceed = primer.getByRole("button", { name: "Continue" })
  await expect(proceed).toBeDisabled()
  await primer.getByRole("checkbox").click()
  await proceed.click()
  await expect(primer).toBeHidden()

  const lens = await lensVault()
  await expect(page.getByTestId("share-price")).toHaveText(`${formatTokenAmount(await readVault<bigint>("sharePrice"), 6, { minFractionDigits: 6, maxFractionDigits: 6 })} USDG`)
  await expect(page.getByTestId("stat-total-deposits")).toHaveText(usdg(await readVault<bigint>("totalAssets"), 0))
  await expect(page.getByTestId("rate-supply")).toHaveText(bps(lens.supplyRateBps))
  await expect(page.getByTestId("reserve-balance")).toHaveText(usdg(lens.reserveBalance))
  await keyOpen(page, "Deficits")
  await expect(page.getByTestId("deficits-empty")).toHaveText(/No deficits recognised/)
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("lend-deficits-sheet")).toBeHidden()

  const form = page.getByTestId("deposit-form")
  await form.getByLabel("Deposit USDG").fill("250")
  const yearly = (250_000_000n * lens.supplyRateBps) / 10_000n
  await keyOpen(page, "About Earnings")
  await expect(page.getByTestId("lend-earnings").getByText(usdg(yearly)).first()).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("lend-earnings")).toBeHidden()
  await page.getByTestId("rate-curve-toggle").focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("rate-curve-toggle")).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Enter")

  await form.getByRole("button", { name: "Review", exact: true }).click()
  const review = page.getByTestId("lend-deposit-review")
  await expect(review.getByTestId("deposit-receipt")).toContainText("Intatto USDG vault")
  await review.getByRole("button", { name: "Approve USDG" }).click()
  const depositButton = review.getByRole("button", { name: "Deposit USDG", exact: true })
  await expect(depositButton).toBeEnabled({ timeout: 60_000 })
  await clearToasts(page)
  await depositButton.click()
  await expect(review.getByText(/Confirmed/)).toBeVisible({ timeout: 60_000 })
  await page.keyboard.press("Escape")
  const afterDeposit = await readVault<bigint>("convertToAssets", [await readVault<bigint>("balanceOf", [burner])])
  expect(afterDeposit).toBeGreaterThanOrEqual(249_999_999n)
  await expect(page.getByTestId("position-value")).toHaveText(usdg(afterDeposit, 6), { timeout: 30_000 })

  await clearToasts(page)
  await page.getByRole("tab", { name: "Withdraw" }).click()
  const wform = page.getByTestId("withdraw-form")
  await wform.getByLabel("Withdraw USDG").fill("100")
  await wform.getByRole("button", { name: "Review", exact: true }).click()
  const wreview = page.getByTestId("lend-withdraw-review")
  const withdrawButton = wreview.getByRole("button", { name: "Withdraw USDG", exact: true })
  await expect(withdrawButton).toBeEnabled({ timeout: 60_000 })
  await clearToasts(page)
  await withdrawButton.click()
  await expect(wreview.getByText(/Confirmed/)).toBeVisible({ timeout: 60_000 })
  const afterWithdraw = await readVault<bigint>("convertToAssets", [await readVault<bigint>("balanceOf", [burner])])
  expect(afterDeposit - afterWithdraw).toBe(100_000_000n)
  await expect(page.getByTestId("position-value")).toHaveText(usdg(afterWithdraw, 6), { timeout: 30_000 })
  await page.keyboard.press("Escape")
  await page.screenshot({ path: "proof/lend-deposit.png", fullPage: true })
})

test("reserve exhaustion: the idle limit, then the recognised deficit and the lower share price", async ({ page, useFork }) => {
  test.setTimeout(600_000)
  const { fork, ctx } = h
  await page.setViewportSize(viewports.wide)
  await useFork(page, h.env)
  await acceptTerms(page)
  const borrowed = await scenarios.openAtWeekdayLimit(ctx, BORROWER, 20n * 10n ** 18n)
  const taken = (await readVault<bigint>("idle")) - 60_000_000n
  await fork.write(SANDBOX_LENDER, vault, lendingVaultAbi, "withdraw", [taken, SANDBOX_LENDER, SANDBOX_LENDER], LENDER_GAS)
  await page.goto("/lend")
  await page.getByRole("tab", { name: "Withdraw" }).click()
  const wform = page.getByTestId("withdraw-form")
  await wform.getByLabel("Withdraw USDG").fill("150")
  await expect(wform.getByText("Only 60.00 USDG is idle; the rest is lent out.")).toBeVisible({ timeout: 60_000 })
  await expect(wform.getByRole("button", { name: "Only 60.00 USDG is idle" })).toBeDisabled()
  await wform.getByRole("button", { name: "Max" }).click()
  await expect(wform.getByLabel("Withdraw USDG")).toHaveValue("60")
  await fork.write(SANDBOX_LENDER, vault, lendingVaultAbi, "deposit", [taken, SANDBOX_LENDER], LENDER_GAS)

  const priceBefore = await readVault<bigint>("sharePrice")
  await scenarios.gapReplay(ctx, replay("nvda-2025-01-gap.json"))
  const { slices } = await scenarios.syntheticGap(ctx, replay("synthetic-gap.json")).catch(async (e) => {
    await printChainTail()
    throw e
  })
  const events: { amount: bigint; sharePriceBefore: bigint; sharePriceAfter: bigint }[] = []
  for (const hash of slices as Hex[]) {
    const receipt = await fork.client.getTransactionReceipt({ hash })
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== vault.toLowerCase()) continue
      try {
        const ev = decodeEventLog({ abi: lendingVaultAbi, data: log.data, topics: log.topics })
        if (ev.eventName === "DeficitRecognised") events.push(ev.args as (typeof events)[number])
      } catch { /* another vault event */ }
    }
  }
  expect(events.length, "the scenario produced a DeficitRecognised event").toBeGreaterThan(0)
  const deficit = events[events.length - 1]!
  const priceNow = await readVault<bigint>("sharePrice")
  console.info(`[lend] borrowed ${usdg(borrowed, 6)}; DeficitRecognised ${usdg(deficit.amount, 6)}; share price ${deficit.sharePriceBefore} → ${deficit.sharePriceAfter} (before ${priceBefore}, now ${priceNow})`)
  expect(deficit.sharePriceAfter).toBeLessThan(deficit.sharePriceBefore)

  await page.goto("/lend#deficits")
  const num = (v: bigint) => formatTokenAmount(v, 6, { minFractionDigits: 6, maxFractionDigits: 6 })
  await expect(page.getByTestId("deficit-count")).toHaveText(String(events.length), { timeout: 120_000 })
  await expect(page.getByTestId("lend-deficits-sheet")).toBeVisible()
  await expect(page.getByTestId("deficit-amount").first()).toHaveText(usdg(deficit.amount, 6), { timeout: 30_000 })
  await expect(page.getByTestId("deficit-price").first()).toHaveText(`${num(deficit.sharePriceBefore)} → ${num(deficit.sharePriceAfter)}`, { timeout: 30_000 })
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("deficit-total")).toHaveText(usdg(await readVault<bigint>("totalDeficit"), 6))
  await expect(page.getByTestId("share-price")).toHaveText(`${num(priceNow)} USDG`)
  expect(priceNow).toBeLessThan(priceBefore)
  const lens = await lensVault()
  await expect(page.getByTestId("reserve-balance")).toHaveText(usdg(lens.reserveBalance))
  await page.goto("/lend#risk")
  const risk = page.getByTestId("lend-risk-sheet")
  await expect(risk).toBeVisible({ timeout: 30_000 })
  await expect(risk.getByTestId("waterfall-reserve")).toHaveText(usdg(lens.reserveBalance))
  await expect(risk.getByTestId("loss-example")).toHaveText(lossExample(await readVault<bigint>("totalAssets")))
  await expect(risk.getByTestId("risk-page-link")).toHaveAttribute("href", "/risk")
  await page.keyboard.press("Escape")
  await expect(risk).toBeHidden()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: "proof/lend.png", fullPage: true })
})

test("sandbox with SPYx lists every deployed market", async ({ page, useFork }) => {
  test.setTimeout(300_000)
  const spyH = await startForkHarness({ spyx: true })
  try {
    expect(spyH.deployment.markets.map((m) => m.symbol)).toEqual(["NVDAx", "SPYx"])
    await scenarios.openAtWeekdayLimit(spyH.ctx, BORROWER, 2n * 10n ** 18n)
    await page.setViewportSize(viewports.wide)
    await useFork(page, spyH.env)
    await acceptTerms(page)
    await page.goto("/lend#allocation")
    await expect(page.getByTestId("lend-page")).toBeVisible({ timeout: 120_000 })
    await expect(page.locator("#allocation")).not.toContainText("one market")
    await expect(page.getByTestId("lend-markets")).toHaveText("Exposure: NVDAx and SPYx")
    await expect(page.getByTestId("overview-markets")).toHaveText("2 (NVDAx, SPYx)")
    await expect(page.getByTestId("allocation-table")).toBeVisible({ timeout: 30_000 })
    for (const m of spyH.deployment.markets) {
      const lens = await spyH.fork.read<{ totalDebt: bigint; totalCollateralValue: bigint; liquidationThresholdBps: bigint; capUsdg: bigint }>(spyH.deployment.lens as Address, marketLensAbi, "market", [m.market])
      const cell = (key: string) => page.getByTestId(`allocation-${m.symbol}-${key}`).filter({ visible: true })
      await expect(cell("debt")).toHaveText(usdg(lens.totalDebt), { timeout: 30_000 })
      await expect(cell("collateral")).toHaveText(usdg(lens.totalCollateralValue))
      await expect(cell("threshold")).toHaveText(bpsText(lens.liquidationThresholdBps, 0))
      await expect(cell("cap")).toHaveText(usdg(lens.capUsdg, 0))
    }
    await expect(page.getByTestId("allocation-SPYx").filter({ visible: true })).toContainText("Sandbox only")
  } finally {
    await spyH.stop()
  }
})

test("fits 390, 768 and 1440 px without sideways scrolling", async ({ page, useFork }) => {
  test.setTimeout(240_000)
  await useFork(page, h.env)
  await page.setViewportSize(viewports.narrow)
  await page.goto("/lend")
  const primer = page.getByTestId("lend-primer")
  await expect(primer).toBeVisible({ timeout: 120_000 })
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/lend-primer-390.png" })
  await primer.getByRole("checkbox").click()
  await primer.getByRole("button", { name: "Continue" }).click()
  await expect(primer).toBeHidden()

  for (const size of Object.values(viewports)) {
    await page.setViewportSize(size)
    await page.goto("/lend#allocation")
    await expect(page.getByTestId("lend-page")).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId("lend-primer")).toBeHidden()
    await expect(page.getByTestId("deficit-count")).not.toHaveText("0")
    await expectNoHorizontalScroll(page)
    const tables = size.width >= 1280
    await expect(page.getByTestId("allocation-card")).toBeVisible({ visible: !tables, timeout: 30_000 })
    await expect(page.getByTestId("allocation-table")).toBeVisible({ visible: tables, timeout: 30_000 })
    await keyOpen(page, "Deficits")
    await expect(page.getByTestId("deficits-table")).toBeVisible({ visible: tables, timeout: 30_000 })
    await expect(page.getByTestId("deficit-card").first()).toBeVisible({ visible: !tables, timeout: 30_000 })
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: `proof/lend-${size.width}.png`, fullPage: true })
    await page.keyboard.press("Escape")
  }
})
