/**
 * Lend screen (pg_lend) on a fork of X Layer: the burner reads the primer, deposits and withdraws USDG through the
 * UI; a withdrawal above idle liquidity is limited with its reason; then a scenario borrower is liquidated through a
 * gap larger than the reserve and the screen shows the DeficitRecognised amount and the lower share price.
 */
import { mkdirSync, readFileSync } from "node:fs"
import type { Page } from "@playwright/test"
import { decodeEventLog, type Address, type Hex } from "viem"
import { lendingVaultAbi, marketLensAbi } from "@intatto/config/abi"
import { test, expect, viewports, expectNoHorizontalScroll } from "./fixtures"
import { startForkHarness, SANDBOX_LENDER, type ForkHarness } from "../fork/harness.ts"
import * as scenarios from "../fork/lib/scenarios.ts"
import { formatTokenAmount } from "../../web/components/ui/web3/format.ts"
import { lossExample, usdg } from "../../web/components/lend/lend-format.ts"

test.describe.configure({ mode: "serial" })
// Several specs share checks/ui/.results and each run clears it; a trace file removed mid-run fails the test,
// so this spec keeps no trace. Its evidence is the proof/lend*.png screenshots and the assertions.
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
    h.deployment.lens as Address,
    marketLensAbi,
    "vault",
    [m.market],
  )
}
const readVault = <T>(fn: string, args: unknown[] = []) => h.fork.read<T>(vault, lendingVaultAbi, fn, args)

/** On a scenario failure: the last blocks' timestamps and the ledger tail, so a revert can be explained. */
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

/** Moves the mouse off the toaster (hovering pauses it) and waits until no toast covers the panel. */
async function clearToasts(page: Page) {
  await page.mouse.move(1, 1)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 20_000 })
}

/** Marks the lending terms as accepted before the page loads (the primer itself is checked in its own test). */
async function acceptTerms(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("intatto:lend-terms:v1", "accepted")
    } catch {
      // opaque origins have no storage
    }
  })
}

test.beforeAll(async () => {
  test.setTimeout(300_000)
  h = await startForkHarness()
  vault = h.deployment.vault as Address
  burner = h.env.burnerAddress
  mkdirSync("proof", { recursive: true })
})

test.afterAll(async () => {
  await h?.stop()
})

test("small amounts keep their digits and the loss example never states more than 100%", () => {
  // X Layer mainnet held about 1.4975 USDG when QA found "1 USDG" and a 66,777.829% drop per 1,000 USDG.
  expect(usdg(1_497_500n, 0)).toBe("1.4975 USDG")
  expect(usdg(1_497_502n)).toBe("1.4975 USDG")
  expect(usdg(400_000n)).toBe("0.40 USDG")
  expect(usdg(150_500_000n, 0)).toBe("150.5 USDG")
  expect(usdg(50_150_000_000n, 0)).toBe("50,150 USDG")
  expect(lossExample(1_497_500n)).toBe(
    "The vault holds 1.4975 USDG today, so a write-off that size would wipe out all deposits.",
  )
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

  // 1. First visit: the primer gates the first deposit until the terms box is ticked.
  const primer = page.getByTestId("lend-primer")
  await expect(primer).toBeVisible({ timeout: 120_000 })
  const proceed = primer.getByRole("button", { name: "Continue" })
  await expect(proceed).toBeDisabled()
  await primer.getByRole("checkbox").click()
  await proceed.click()
  await expect(primer).toBeHidden()

  // 2. The vault page: headline numbers equal the contracts.
  const lens = await lensVault()
  await expect(page.getByTestId("share-price")).toHaveText(`${formatTokenAmount(await readVault<bigint>("sharePrice"), 6, { minFractionDigits: 6, maxFractionDigits: 6 })} USDG`)
  await expect(page.getByTestId("stat-total-deposits")).toHaveText(usdg(await readVault<bigint>("totalAssets"), 0))
  await expect(page.getByTestId("rate-supply")).toHaveText(bps(lens.supplyRateBps))
  await expect(page.getByTestId("reserve-balance")).toHaveText(usdg(lens.reserveBalance))
  await expect(page.getByTestId("deficits-empty")).toHaveText(/No deficits recognised/)

  // 3. Deposit: typing projects earnings and shows the receipt; approve, then deposit.
  const form = page.getByTestId("deposit-form")
  await form.getByLabel("Deposit USDG").fill("250")
  const yearly = (250_000_000n * lens.supplyRateBps) / 10_000n
  await expect(form.getByText(usdg(yearly)).first()).toBeVisible()
  await expect(page.getByTestId("deposit-receipt")).toContainText("Intatto USDG vault")
  await form.getByRole("button", { name: "Approve USDG" }).click()
  const depositButton = form.getByRole("button", { name: "Deposit USDG", exact: true })
  await expect(depositButton).toBeEnabled({ timeout: 60_000 })
  await clearToasts(page)
  await depositButton.click()
  await expect(form.getByText(/Confirmed/)).toBeVisible({ timeout: 60_000 })
  const afterDeposit = await readVault<bigint>("convertToAssets", [await readVault<bigint>("balanceOf", [burner])])
  expect(afterDeposit).toBeGreaterThanOrEqual(249_999_999n)
  await expect(page.getByTestId("position-value")).toHaveText(usdg(afterDeposit, 6), { timeout: 30_000 })

  // 4. Withdraw part of it.
  await clearToasts(page)
  await page.getByRole("tab", { name: "Withdraw" }).click()
  const wform = page.getByTestId("withdraw-form")
  await wform.getByLabel("Withdraw USDG").fill("100")
  const withdrawButton = wform.getByRole("button", { name: "Withdraw USDG", exact: true })
  await expect(withdrawButton).toBeEnabled({ timeout: 60_000 })
  await clearToasts(page)
  await withdrawButton.click()
  await expect(wform.getByText(/Confirmed/)).toBeVisible({ timeout: 60_000 })
  const afterWithdraw = await readVault<bigint>("convertToAssets", [await readVault<bigint>("balanceOf", [burner])])
  expect(afterDeposit - afterWithdraw).toBe(100_000_000n)
  await expect(page.getByTestId("position-value")).toHaveText(usdg(afterWithdraw, 6), { timeout: 30_000 })
  await page.screenshot({ path: "proof/lend-deposit.png", fullPage: true })
})

test("reserve exhaustion: the idle limit, then the recognised deficit and the lower share price", async ({ page, useFork }) => {
  test.setTimeout(600_000)
  const { fork, ctx } = h
  await page.setViewportSize(viewports.wide)
  await useFork(page, h.env)
  await acceptTerms(page)

  // A scenario borrower opens at the 50% weekday limit during regular US hours.
  const borrowed = await scenarios.openAtWeekdayLimit(ctx, BORROWER, 20n * 10n ** 18n)

  // Idle limit: the lender takes out almost all idle USDG, so the burner's withdrawal is limited; then puts it back.
  // (Not an evm snapshot/revert: in a run that reverted a snapshot here, the later keeper session post reverted.)
  const taken = (await readVault<bigint>("idle")) - 60_000_000n
  // Explicit gas: with anvil's estimate this withdrawal once reverted without revert data, while the same call
  // succeeded against its parent block.
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

  // The Jan-2025 replay, then a synthetic gap larger than the reserve.
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
      } catch {
        // another vault event
      }
    }
  }
  expect(events.length, "the scenario produced a DeficitRecognised event").toBeGreaterThan(0)
  const deficit = events[events.length - 1]!
  const priceNow = await readVault<bigint>("sharePrice")
  console.info(
    `[lend] borrowed ${usdg(borrowed, 6)}; DeficitRecognised ${usdg(deficit.amount, 6)}; share price ` +
      `${deficit.sharePriceBefore} → ${deficit.sharePriceAfter} (before the scenario ${priceBefore}, now ${priceNow})`,
  )
  expect(deficit.sharePriceAfter).toBeLessThan(deficit.sharePriceBefore)

  // The screen shows exactly what the vault recorded.
  await page.goto("/lend")
  const num = (v: bigint) => formatTokenAmount(v, 6, { minFractionDigits: 6, maxFractionDigits: 6 })
  const price = (v: bigint) => `${num(v)} USDG`
  await expect(page.getByTestId("deficit-count")).toHaveText(String(events.length), { timeout: 120_000 })
  await expect(page.getByTestId("deficit-amount").first()).toHaveText(usdg(deficit.amount, 6))
  await expect(page.getByTestId("deficit-price").first()).toHaveText(
    `${num(deficit.sharePriceBefore)} → ${num(deficit.sharePriceAfter)}`,
  )
  await expect(page.getByTestId("deficit-total")).toHaveText(usdg(await readVault<bigint>("totalDeficit"), 6))
  await expect(page.getByTestId("share-price")).toHaveText(price(priceNow))
  expect(priceNow).toBeLessThan(priceBefore)
  const lens = await lensVault()
  await expect(page.getByTestId("reserve-balance")).toHaveText(usdg(lens.reserveBalance))
  await expect(page.getByTestId("waterfall-reserve")).toHaveText(usdg(lens.reserveBalance))
  await expect(page.getByTestId("loss-example")).toHaveText(lossExample(await readVault<bigint>("totalAssets")))
  await expect(page.getByTestId("risk-page-link")).toHaveAttribute("href", "/risk")

  // Full-page capture from the top, so the sticky header and panel sit where a person sees them.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: "proof/lend.png", fullPage: true })
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
    await page.goto("/lend")
    await expect(page.getByTestId("lend-page")).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId("lend-primer")).toBeHidden()
    await expect(page.getByTestId("deficit-count")).not.toHaveText("0")
    await expectNoHorizontalScroll(page)
    // Tables from 1280 px; below that the allocation and the deficits stack as cards.
    const tables = size.width >= 1280
    await expect(page.getByTestId("allocation-card")).toBeVisible({ visible: !tables })
    await expect(page.getByTestId("allocation-table")).toBeVisible({ visible: tables })
    await expect(page.getByTestId("deficits-table")).toBeVisible({ visible: tables })
    await expect(page.getByTestId("deficit-card").first()).toBeVisible({ visible: !tables })
    await page.screenshot({ path: `proof/lend-${size.width}.png`, fullPage: true })
  }
})
