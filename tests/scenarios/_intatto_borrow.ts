/**
 * Borrow-screen journey pieces for the Abel scenario specs (sc_borrow, and reused by the sandbox journeys): edge
 * cases driven on the fork fixture, the Monday-gap rows the contract's own liquidation test implies, repay in full
 * and withdraw everything. Every UI value is compared with a contract read; nothing here signs outside the app.
 */
import type { StepArgs } from "./_abel"
import { formatUnits, type Address, type Hex, type PublicClient } from "viem"
import type { Deployment } from "@intatto/config/deployments"
import { collateralMarketAbi } from "@intatto/config/abi"
import { REFUSALS } from "@intatto/config/session"
import * as forkAbi from "../../checks/fork/lib/abis.ts"
import { calendarSession } from "../../checks/fork/lib/clock.ts"
import { keeperTick } from "../../checks/fork/lib/scenarios.ts"
import { expect, fixtureKind, forkAccess, health, lens, observe, observeCall, pct, shows, usd, usdg, nvdax } from "./_intatto"

/** The page the Abel harness hands each step (its own Playwright copy). */
type Page = StepArgs["page"]

/** Chain access for the Borrow journeys: the fork fixture's anvil, or the sandbox session's public RPC. */
async function access() {
  let base: { client: PublicClient; d: Deployment; burner: Address }
  if (fixtureKind() === "fork") {
    const x = forkAccess()
    base = { client: x.fork.client as PublicClient, d: x.d, burner: x.f.burnerAddress }
  } else {
    const { sessionChain } = await import("./_intatto_sandbox")
    const x = await sessionChain()
    base = { client: x.client, d: x.d, burner: x.burner }
  }
  const nvda = base.d.markets.find((m) => m.symbol === "NVDAx")!
  const L = await lens(base.client as never, base.d, base.burner)
  const nonce = () => base.client.getTransactionCount({ address: base.burner })
  const simulate = (functionName: string, args: unknown[]) =>
    base.client
      .simulateContract({ address: nvda.market as Address, abi: collateralMarketAbi, functionName, args, account: base.burner } as never)
      .then(() => "accepted", (e: Error) => e.message)
  const read = <T>(to: string, abi: unknown, functionName: string, args: unknown[] = []) =>
    base.client.readContract({ address: to as Address, abi, functionName, args } as never) as Promise<T>
  return { ...base, nvda, L, nonce, simulate, read }
}

const borrowForm = (page: Page) => page.getByTestId("deposit-borrow-form")
const borrowCta = (page: Page) => borrowForm(page).locator('[data-slot="form-cta"] button')
const repayForm = (page: Page) => page.getByTestId("repay-withdraw-form")
const repayCta = (page: Page) => repayForm(page).locator('[data-slot="form-cta"] button')
const errorName = (message: string) => message.match(/(StalePrice|PriceOutOfBand|TickerCapReached|Unhealthy|SessionLimit|CorporateActionPending)/)?.[1] ?? "none"

/** 31 minutes pass with no price post (the keeper keeps posting the session): borrowing stops, repay and deposit do not. */
export async function edgeBadPrice(page: Page) {
  const { L, nonce, simulate } = await access()
  const { fork, ctx } = forkAccess()
  const n0 = await nonce()
  await fork.warpBy(31 * 60, "edge case: 31 minutes with no keeper price post")
  const cal = calendarSession(await fork.chainTime())
  await ctx.keeper.session(cal.session, cal.periodChangedAt)
  expect((await L.market()).fresh).toBe(false)
  await page.locator("#borrow-loan").fill("1")
  await expect(borrowCta(page)).toHaveText(/^Refused: (StalePrice|PriceOutOfBand)$/, { timeout: 60_000 })
  const label = await borrowCta(page).innerText()
  await expect(borrowCta(page)).toBeDisabled()
  await expect(borrowForm(page)).toContainText("Nothing was signed or sent")
  await expect(page.getByTestId("market-status")).toContainText("New borrowing is paused")
  const sim = await simulate("borrow", [1_000_000n])
  expect(sim).toMatch(/StalePrice|PriceOutOfBand/)
  await page.locator("#borrow-loan").fill("")
  await page.locator("#borrow-collateral").fill("1")
  await expect(borrowCta(page)).toHaveText("Review", { timeout: 45_000 })
  await expect(borrowCta(page)).toBeEnabled()
  await page.locator("#borrow-collateral").fill("")
  await page.getByRole("tab", { name: "Repay & withdraw" }).click()
  await expect(repayForm(page)).toContainText("Repaying never depends on the price or the market session")
  await page.locator("#repay-amount").fill("1")
  await expect(repayCta(page)).toHaveText("Review", { timeout: 45_000 })
  await expect(repayCta(page)).toBeEnabled()
  await page.locator("#repay-amount").fill("")
  await page.getByRole("tab", { name: "Deposit & borrow" }).click()
  expect(await nonce()).toBe(n0)
  const tick = await keeperTick(ctx)
  expect(tick.accepted).toBe(true)
  await expect(page.getByTestId("market-status")).toHaveCount(0, { timeout: 60_000 })
  return `31 min of chain time with only a session post (MarketLens fresh=false): typing 1 USDG shows "${label}" (disabled), "Nothing was signed or sent" and "New borrowing is paused"; eth_call borrow(1 USDG) reverts ${errorName(sim)}; with the price stale, a 1 NVDAx deposit still reaches "Review" and a 1 USDG repay (tab says "Repaying never depends on the price or the market session") still reaches "Review"; burner nonce stayed ${n0}. The keeper then posted a fresh price (accepted) and the pause cleared`
}

/** With debt open, withdrawing all the collateral is refused before signing; the collateral stays. */
export async function edgeWithdrawUnhealthy(page: Page) {
  const { burner, nvda, nonce, simulate, read } = await access()
  const n0 = await nonce()
  const [shares, debt] = await read<[bigint, bigint]>(nvda.market, forkAbi.market, "positionOf", [burner])
  const assets = await read<bigint>(nvda.wrapper, forkAbi.wrapper, "convertToAssets", [shares])
  expect(debt).toBeGreaterThan(0n)
  await page.getByRole("tab", { name: "Repay & withdraw" }).click()
  await page.locator("#withdraw-amount").fill(formatUnits(assets, 18))
  await expect(repayCta(page)).toBeDisabled({ timeout: 45_000 })
  await expect(repayCta(page)).not.toHaveText(/^(Review|Enter an amount)$/)
  const label = await repayCta(page).innerText()
  await expect(repayForm(page)).toContainText("You can withdraw up to")
  const reason = (await repayForm(page).locator('[data-slot="amount-input"]').nth(1).innerText()).replace(/\s+/g, " ")
  const sim = await simulate("withdrawCollateral", [shares, true])
  expect(sim).toContain("Unhealthy")
  await page.locator("#withdraw-amount").fill("")
  await page.getByRole("tab", { name: "Deposit & borrow" }).click()
  const [after] = await read<[bigint, bigint]>(nvda.market, forkAbi.market, "positionOf", [burner])
  expect(after).toBe(shares)
  expect(await nonce()).toBe(n0)
  return `With ${formatUnits(debt, 6)} USDG owed, typing all ${nvdax(assets)} to withdraw: button "${label}" (disabled); field says "${reason.slice(reason.indexOf("Withdrawal") >= 0 ? reason.indexOf("Withdrawal") : 0).slice(0, 200)}"; eth_call withdrawCollateral(all shares) reverts ${errorName(sim)} ("${REFUSALS.Unhealthy}"); shares still ${after} in the market; nonce stayed ${n0}`
}

/** The keeper lowers the ticker cap to the market's current debt: any new borrow is refused before signing. */
export async function edgeTickerCap(page: Page) {
  const { L, nonce, simulate } = await access()
  const { ctx } = forkAccess()
  const n0 = await nonce()
  const m = await L.market()
  await ctx.keeper.cap(m.totalDebt, m.sliceUsdg)
  const after = await L.market()
  expect(after.capUsdg).toBe(m.totalDebt)
  await page.locator("#borrow-loan").fill("1")
  await expect(borrowCta(page)).toHaveText("Refused: TickerCapReached", { timeout: 60_000 })
  await expect(borrowCta(page)).toBeDisabled()
  await expect(borrowForm(page)).toContainText("Nothing was signed or sent")
  const sim = await simulate("borrow", [1_000_000n])
  expect(sim).toContain("TickerCapReached")
  await page.locator("#borrow-loan").fill("")
  expect(await nonce()).toBe(n0)
  return `Keeper posted the NVDAx depth cap down to the market's total debt (${usdg(m.totalDebt)}; effective cap now ${usdg(after.capUsdg)}): typing 1 USDG shows "Refused: TickerCapReached" (disabled) with "Nothing was signed or sent"; eth_call borrow(1 USDG) reverts TickerCapReached; burner nonce stayed ${n0}`
}

/** The Monday-gap rows the screen shows, one string per row. */
async function shownGapRows(page: Page) {
  return page
    .getByTestId("gap-table")
    .locator("table tbody tr")
    .evaluateAll((rows) => rows.map((r) => Array.from((r as HTMLTableRowElement).cells).map((c) => c.textContent!.trim()).join(" ")))
}

/** The same rows from MarketLens values, with CollateralMarketBase.isLiquidatable's own test. */
async function chainGapRows() {
  const { L } = await access()
  const [a, m] = await Promise.all([L.account(), L.market()])
  return [5, 10, 20, 30].map((drop) => {
    const keep = BigInt(100 - drop)
    const value = (a.valueUsdg * keep) / 100n
    const liquidatable = a.debt * 10_000n > value * m.liquidationThresholdBps
    const h = (value * m.liquidationThresholdBps * 10n ** 18n) / (a.debt * 10_000n)
    return `−${drop}% ${usd((m.priceE18 * keep) / 100n)} ${pct((a.debt * 10_000n) / value)} ${health(h)} ${liquidatable ? "Liquidatable" : "Safe"}`
  })
}

export async function gapRowsMatch(page: Page) {
  await shows("Monday-gap rows", async () => (await shownGapRows(page)).join(" / "), async () => (await chainGapRows()).join(" / "))
  return shownGapRows(page)
}

async function doneHash(page: Page, scope: string, text: string): Promise<Hex> {
  const done = page.getByTestId(scope).getByTestId("review-done-step").filter({ hasText: text })
  await expect(done).toBeVisible({ timeout: 60_000 })
  return (await done.locator('[data-slot="explorer-link"]').getAttribute("title")) as Hex
}

async function receiptFromBurner(hash: Hex) {
  const { client, burner, nvda } = await access()
  const r = await client.getTransactionReceipt({ hash })
  expect([r.status, r.from.toLowerCase(), r.to?.toLowerCase()]).toEqual(["success", burner.toLowerCase(), nvda.market.toLowerCase()])
  return r
}

/** Repay tab: Max repays the whole loan; approve USDG if needed; repay; debt reads zero. */
export async function repayAll(page: Page, checks = { tx: "chk_borrow_repay_tx", zero: "chk_borrow_debt_zero", call: "int_borrow_repay" }) {
  const { L } = await access()
  const owed = (await L.account()).debt
  await page.getByRole("tab", { name: "Repay & withdraw" }).click()
  await repayForm(page).locator('[data-slot="amount-input"]').first().getByRole("button", { name: "Max" }).click()
  await expect(repayForm(page)).toContainText("Repays the whole loan")
  await expect(repayCta(page)).toHaveText("Review", { timeout: 45_000 })
  await repayCta(page).click()
  const review = page.getByTestId("repay-review")
  await expect(review.getByRole("button", { name: /^(Approve USDG|Repay the whole loan)$/ })).toBeVisible({ timeout: 60_000 })
  if (await review.getByRole("button", { name: "Approve USDG" }).isVisible()) await review.getByRole("button", { name: "Approve USDG" }).click()
  await review.getByRole("button", { name: "Repay the whole loan" }).click({ timeout: 60_000 })
  await expect(review.getByTestId("review-finished")).toContainText("fully repaid", { timeout: 60_000 })
  const hash = await doneHash(page, "repay-review", "Repaid")
  const r = await receiptFromBurner(hash)
  const a = await L.account()
  expect(a.debt).toBe(0n)
  const shown = await shows("debt", async () => (await page.getByTestId("position-debt").innerText()).split("\n").pop() ?? null, async () => usdg((await L.account()).debt))
  observe(checks.tx, `Repay confirmed: ${hash} (block ${r.blockNumber}) from the burner to the market, listed as "Repaid the whole loan · Confirmed · ${hash.slice(0, 8)}…" (hash as text on the fork, OKLink on X Layer); "fully repaid"`)
  observe(checks.zero, `debtOf(burner) = 0 (was ${formatUnits(owed, 6)} USDG before repaying); position panel debt "${shown}"`)
  observeCall(checks.call, `CollateralMarket.repay confirmed, status success; debt is 0`, hash)
  return hash
}

/** Withdraw tab: Max withdraws everything (no debt left); the position returns to "No position yet". */
export async function withdrawAll(page: Page, checks = { tx: "chk_borrow_withdraw_tx", call: "int_borrow_withdraw" }) {
  const { burner, nvda, L, read } = await access()
  const review = page.getByTestId("repay-review")
  if (await review.isVisible().catch(() => false)) await review.getByRole("button", { name: "Back to the form" }).click()
  await repayForm(page).locator('[data-slot="amount-input"]').nth(1).getByRole("button", { name: "Max" }).click()
  await expect(repayCta(page)).toHaveText("Review", { timeout: 45_000 })
  await repayCta(page).click()
  await review.getByRole("button", { name: /^Withdraw / }).click({ timeout: 60_000 })
  await expect(review.getByTestId("review-finished")).toBeVisible({ timeout: 60_000 })
  const hash = await doneHash(page, "repay-review", "Withdrew")
  const r = await receiptFromBurner(hash)
  const [shares, debt] = await read<[bigint, bigint]>(nvda.market, forkAbi.market, "positionOf", [burner])
  expect([shares, debt]).toEqual([0n, 0n])
  await review.getByRole("button", { name: "Back to the form" }).click()
  await expect(page.getByTestId("position-empty")).toContainText("No position yet.", { timeout: 60_000 })
  const wallet = (await L.account()).walletToken
  observe(checks.tx, `Withdraw confirmed: ${hash} (block ${r.blockNumber}) from the burner to the market, listed as "Withdrew … · Confirmed · ${hash.slice(0, 8)}…"; positionOf = 0 shares, 0 debt; Borrow shows "No position yet." with ${nvdax(wallet)} back in the wallet`)
  observeCall(checks.call, `CollateralMarket.withdrawCollateral confirmed, status success; the market holds 0 shares for the burner`, hash)
  return hash
}

/**
 * Deposit & borrow in one review: `collateral` NVDAx and the loan the risk chip picks, sent approve (if needed) →
 * deposit → borrow. Returns the loan and both transactions.
 */
export async function depositAndBorrow(page: Page, collateral: string, chip: "Low" | "Medium" | "High") {
  const { L } = await access()
  await page.locator("#borrow-collateral").fill(collateral)
  await page.getByRole("button", { name: new RegExp(`^${chip} risk`) }).click()
  const { parseUnits } = await import("viem")
  const loan = parseUnits(await page.locator("#borrow-loan").inputValue(), 6)
  expect(loan).toBeGreaterThan(0n)
  await expect(borrowCta(page)).toHaveText("Review", { timeout: 60_000 })
  await borrowCta(page).click()
  const review = page.getByTestId("borrow-review")
  await expect(review.getByRole("button", { name: /^(Approve NVDAx|Deposit )/ })).toBeVisible({ timeout: 60_000 })
  if (await review.getByRole("button", { name: "Approve NVDAx" }).isVisible()) await review.getByRole("button", { name: "Approve NVDAx" }).click()
  await review.getByRole("button", { name: /^Deposit / }).click({ timeout: 60_000 })
  const depositHash = await doneHash(page, "borrow-review", "Deposited")
  await review.getByRole("button", { name: `Borrow ${usdg(loan)}` }).click({ timeout: 60_000 })
  const borrowHash = await doneHash(page, "borrow-review", "Borrowed")
  await expect(review.getByTestId("review-finished")).toBeVisible({ timeout: 60_000 })
  const [dr, br] = [await receiptFromBurner(depositHash), await receiptFromBurner(borrowHash)]
  const a = await L.account()
  return { loan, depositHash, borrowHash, depositBlock: dr.blockNumber, borrowBlock: br.blockNumber, account: a }
}

/** The loan field's "Can borrow" figure, as shown. */
export async function canBorrowShown(page: Page) {
  const field = borrowForm(page).locator('[data-slot="amount-input"]').nth(1)
  await expect(field).toContainText("Can borrow", { timeout: 60_000 })
  return (await field.innerText()).match(/Can borrow ([\d,.]+ USDG)/)?.[1] ?? ""
}

export { access as borrowAccess, borrowCta, borrowForm, repayCta, repayForm }
