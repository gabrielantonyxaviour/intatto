/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_borrow
 *  mapping:    2
 *  definition: 9e821e1de3d75d3a9fe31ec8cc9e687e6c53ab375f6497a4b61680357c99d557
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_borrow", "borrower", () => {
  step("borrow_connect", "Connect on Market", async ({ page }) => {
    // action:   Open Market and connect the wallet on chain 196.
    // expected: Market is in the connected state: session, max new-borrow LTV, relayed NVDAx price with the keeper's fetch time and guard status, and the relay disclosure are shown, with the wallet address on chain 196.
    // >>> abel:borrow_connect
    const I = await import("./_intatto"), { expect } = I, abi = await import("@intatto/config/abi"), { SESSIONS } = await import("@intatto/config/session")
    const { f, fork, d, nvda } = I.forkAccess()
    const relay = () => fork.read<[bigint, bigint]>(nvda.priceRelay as never, abi.priceRelayAdapterAbi as never, "latestPrice")
    const guards = () => fork.read<Record<string, boolean>>(nvda.priceRelay as never, abi.priceRelayAdapterAbi as never, "guardStatus")
    await I.seedSandbox(page, { sessionId: "local-check", apiUrl: "", rpcUrl: f.rpcUrl, chainId: f.chainId, forkBlock: f.forkBlock, deployment: d, burnerKey: f.burnerKey })
    await page.goto("/")
    await expect(page.getByTestId("headline-stats")).toBeVisible({ timeout: 180_000 })
    const detail = page.getByTestId("market-detail-NVDAx")
    const session = await I.shows("session", () => detail.getByTestId("session-value").getAttribute("data-session"), async () => SESSIONS[Number(await fork.read<number>(d.sessionRisk as never, abi.sessionRiskControllerAbi as never, "currentSession"))]!)
    const maxLtv = await I.shows("max LTV", () => detail.getByTestId("tile-max-ltv").locator("[data-slot=value]").textContent(), async () => I.pct(await fork.read<bigint>(d.sessionRisk as never, abi.sessionRiskControllerAbi as never, "maxLtvBps")))
    const price = await I.shows("price", () => detail.getByTestId("price-value").textContent(), async () => I.usd((await relay())[0]))
    const fetched = await I.shows("fetched at", () => detail.getByTestId("price-fetched-at").textContent(), async () => I.utc((await relay())[1]))
    const shownGuards: string[] = []
    for (const k of ["fresh", "inBand", "pegOk"]) shownGuards.push(`${k}=${await I.shows(`guard ${k}`, () => detail.getByTestId(`guard-${k}`).getAttribute("data-ok"), async () => String((await guards())[k]))}`)
    await page.mouse.move(0, 0, { steps: 8 })
    await page.getByTestId("chip-relay").hover()
    const tip = page.getByTestId("chip-relay-tooltip")
    await expect(tip).toContainText("trusted relayer, bounded onchain by keeper liveness")
    const disclosure = (await tip.innerText()).replace(/\s+/g, " ").trim()
    await page.mouse.move(0, 0, { steps: 8 })
    const burner = f.burnerAddress
    await expect(page.getByRole("button", { name: `Sandbox burner ${burner}` })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId("your-info-connected")).toBeVisible({ timeout: 60_000 })
    const banner = page.locator('[data-slot="sandbox-banner"]')
    await expect(banner).toContainText(`fork of X Layer mainnet at block ${f.forkBlock}`)
    await expect(banner).toContainText(`chain ${f.chainId}`)
    const chainId = await fork.client.getChainId()
    expect(chainId).toBe(f.chainId)
    const nonce = await fork.client.getTransactionCount({ address: burner })
    expect(nonce).toBe(0)
    I.observe("chk_borrow_market_state", `Market, connected on the sandbox fork: session ${session} = SessionRiskController.currentSession(); max new-borrow LTV ${maxLtv} = maxLtvBps(); NVDAx ${price} "fetched by the keeper at ${fetched}" = PriceRelayAdapter.latestPrice(); guards ${shownGuards.join(", ")} = guardStatus(); relay disclosure tooltip: "${disclosure}"; header "Sandbox burner ${burner}"; banner "fork of X Layer mainnet at block ${f.forkBlock} · chain ${f.chainId}" (the sandbox chain id for a fork of chain 196)`)
    I.observeCall("int_borrow_wallet", `Sandbox burner ${burner} connected with no wallet prompt; eth_chainId ${chainId} (fork of X Layer 196 at block ${f.forkBlock}); burner nonce ${nonce}: nothing signed`)
    // <<< abel:borrow_connect
  })
  step("borrow_open", "Open Borrow with no position", async ({ page }) => {
    // action:   Follow Borrow from Market.
    // expected: Borrow shows the wallet's NVDAx balance and no position.
    // >>> abel:borrow_open
    const I = await import("./_intatto"), { expect } = I
    const { f, fork, d } = I.forkAccess()
    const L = await I.lens(fork.client as never, d, f.burnerAddress)
    await page.getByTestId("your-info").getByRole("link", { name: "Borrow USDG" }).click()
    await expect(page).toHaveURL(/\/borrow(?:\?market=NVDAx)?$/, { timeout: 60_000 })
    await expect(page.getByTestId("borrow-screen")).toBeVisible({ timeout: 120_000 })
    const a = await L.account()
    expect(a.shares).toBe(0n)
    expect(a.debt).toBe(0n)
    const empty = page.getByTestId("position-empty")
    await expect(empty).toContainText("No position yet.", { timeout: 60_000 })
    await expect(empty).toContainText(`Your wallet holds ${I.nvdax(a.walletToken)}.`)
    I.observe("chk_borrow_no_position", `Borrow shows "No position yet." and "Your wallet holds ${I.nvdax(a.walletToken)}" = NVDAx.balanceOf(burner) ${I.plain(a.walletToken, 18)}; MarketLens.account: 0 wNVDAx shares, 0 USDG debt`)
    // <<< abel:borrow_open
  })
  step("borrow_deposit", "Deposit NVDAx", async ({ page }) => {
    // action:   Approve NVDAx, then deposit it as collateral.
    // expected: Two transactions, approve then deposit, each linked to the explorer. The position shows collateral in NVDAx and wNVDAx units with the current multiplier and its value.
    // >>> abel:borrow_deposit
    const I = await import("./_intatto"), { expect } = I, abi = await import("@intatto/config/abi"), forkAbi = await import("../../checks/fork/lib/abis.ts")
    const { formatTokenAmount } = await import("../../web/components/ui/web3/format.ts")
    const { f, fork, d, nvda } = I.forkAccess()
    const L = await I.lens(fork.client as never, d, f.burnerAddress)
    const burner = f.burnerAddress.toLowerCase()
    const deposit = 4n * 10n ** 18n
    const form = page.getByTestId("deposit-borrow-form")
    await page.locator("#borrow-collateral").fill("4")
    const cta = form.locator('[data-slot="form-cta"] button')
    await expect(cta).toHaveText("Review", { timeout: 60_000 })
    await cta.click()
    const review = page.getByTestId("borrow-review")
    // The approve's button shows its transaction only until the allowance re-reads, so record every tx the review renders.
    await I.watchTxLinks(page, "borrow-review")
    await review.getByRole("button", { name: "Approve NVDAx" }).click()
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "NVDAx approved" })).toBeVisible({ timeout: 60_000 })
    const { parseAbiItem } = await import("viem")
    const approval = await fork.client.getLogs({ address: nvda.token as `0x${string}`, event: parseAbiItem("event Approval(address indexed owner, address indexed spender, uint256 value)"), args: { owner: f.burnerAddress, spender: nvda.market as `0x${string}` }, fromBlock: BigInt(f.forkBlock) })
    const approveHash = approval.at(-1)!.transactionHash
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "NVDAx approved" })).toContainText(approveHash.slice(0, 10))
    expect(await I.seenTxLinks(page)).toContain(approveHash)
    const ar = await fork.client.getTransactionReceipt({ hash: approveHash })
    expect([ar.status, ar.from.toLowerCase(), ar.to?.toLowerCase()]).toEqual(["success", burner, nvda.token.toLowerCase()])
    await review.getByRole("button", { name: /^Deposit / }).click({ timeout: 60_000 })
    const done = review.getByTestId("review-done-step").filter({ hasText: "Deposited" })
    await expect(done).toContainText(`Deposited ${I.nvdax(deposit)}`, { timeout: 60_000 })
    const depositHash = (await done.locator('[data-slot="explorer-link"]').getAttribute("title")) as `0x${string}`
    const dr = await fork.client.getTransactionReceipt({ hash: depositHash })
    expect([dr.status, dr.from.toLowerCase(), dr.to?.toLowerCase()]).toEqual(["success", burner, nvda.market.toLowerCase()])
    expect(ar.blockNumber < dr.blockNumber || (ar.blockNumber === dr.blockNumber && ar.transactionIndex < dr.transactionIndex)).toBe(true)
    await expect(review.getByTestId("review-finished")).toBeVisible({ timeout: 60_000 })
    const a = await L.account()
    const aps = await fork.read<bigint>(nvda.wrapper as never, forkAbi.wrapper as never, "convertToAssets", [10n ** 18n])
    const assets = await fork.read<bigint>(nvda.wrapper as never, forkAbi.wrapper as never, "convertToAssets", [a.shares])
    const [price] = await fork.read<[bigint, bigint]>(nvda.priceRelay as never, abi.priceRelayAdapterAbi as never, "latestPrice")
    const value = (assets * price) / 10n ** 30n
    expect([a.assets, a.valueUsdg]).toEqual([assets, value])
    const multiplier = formatTokenAmount(aps, 18, { maxFractionDigits: 4, minFractionDigits: 4 })
    await expect(page.getByTestId("position-collateral")).toContainText(I.nvdax(assets), { timeout: 60_000 })
    await expect(page.getByTestId("position-shares")).toContainText(I.wnvdax(a.shares))
    await expect(page.getByTestId("position-value")).toContainText(I.usdg(value))
    await expect(page.getByTestId("position-panel")).toContainText(`1 wNVDAx = ${multiplier} NVDAx (issuer multiplier)`)
    I.journey.walletUsdgBefore = a.walletUsdg
    I.observe("chk_borrow_deposit_tx", `Two receipts from the burner, approve then deposit: NVDAx.approve ${approveHash} (block ${ar.blockNumber}) rendered as the Approve button's transaction link while it confirmed (it gives way to the Deposit button once the allowance re-reads) and in the toast "NVDAx approved · Transaction ${approveHash.slice(0, 10)}…"; CollateralMarket.addCollateral ${depositHash} (block ${dr.blockNumber}) listed as "Deposited ${I.nvdax(deposit)} · Confirmed · ${depositHash.slice(0, 8)}…". On the sandbox fork the explorer link renders the full hash as text (no explorer exists for a fork); on X Layer it is an OKLink link`)
    I.observe("chk_borrow_collateral_units", `Position: collateral ${I.nvdax(assets)} = wrapper.convertToAssets(shares); held as ${I.wnvdax(a.shares)} = positionOf shares; "1 wNVDAx = ${multiplier} NVDAx (issuer multiplier)" = convertToAssets(1e18); value ${I.usdg(value)} = assets × relayed ${I.usd(price)} = MarketLens valueUsdg`)
    I.observeCall("int_borrow_approve", `NVDAx.approve(market, 4e18) confirmed, status success, from the burner`, approveHash)
    I.observeCall("int_borrow_deposit", `CollateralMarket.addCollateral(4e18) confirmed; the market holds ${I.plain(a.shares, 18)} wNVDAx shares for the burner`, depositHash)
    // <<< abel:borrow_deposit
  })
  step("borrow_capacity", "Read capacity for the session", async ({ page }) => {
    // action:   Read the borrowing capacity shown for the current session.
    // expected: Capacity equals the collateral value times the current session's max LTV, using the relayed price.
    // >>> abel:borrow_capacity
    const I = await import("./_intatto"), { expect } = I, abi = await import("@intatto/config/abi"), forkAbi = await import("../../checks/fork/lib/abis.ts")
    const { formatUnits, parseUnits } = await import("viem"), { SESSIONS } = await import("@intatto/config/session")
    const { f, fork, d, nvda } = I.forkAccess()
    const L = await I.lens(fork.client as never, d, f.burnerAddress)
    await page.getByTestId("borrow-review").getByRole("button", { name: "Back to the form" }).click()
    const loanField = page.getByTestId("deposit-borrow-form").locator('[data-slot="amount-input"]').nth(1)
    await expect(loanField).toContainText("Can borrow", { timeout: 60_000 })
    const [shares] = await fork.read<[bigint, bigint]>(nvda.market as never, forkAbi.market as never, "positionOf", [f.burnerAddress])
    const assets = await fork.read<bigint>(nvda.wrapper as never, forkAbi.wrapper as never, "convertToAssets", [shares])
    const [price] = await fork.read<[bigint, bigint]>(nvda.priceRelay as never, abi.priceRelayAdapterAbi as never, "latestPrice")
    const maxLtv = await fork.read<bigint>(d.sessionRisk as never, abi.sessionRiskControllerAbi as never, "maxLtvBps")
    const session = SESSIONS[Number(await fork.read<number>(d.sessionRisk as never, abi.sessionRiskControllerAbi as never, "currentSession"))]
    const value = (assets * price) / 10n ** 30n
    const capacity = (value * maxLtv) / 10_000n
    const [m, v, a] = await Promise.all([L.market(), L.vault(), L.account()])
    const capRoom = m.capUsdg - m.totalDebt
    expect(a.borrowCapacity).toBe(capacity)
    expect(capacity - 10_000n < capRoom && capacity - 10_000n < v.idle).toBe(true)
    await expect(page.getByTestId("session-max-ltv").first()).toHaveText(I.pct(maxLtv))
    await expect(page.getByTestId("relayed-price").first()).toHaveText(I.usd(price))
    const shown = (await loanField.innerText()).match(/Can borrow ([\d,.]+) USDG/)?.[1]
    await loanField.getByRole("button", { name: "Max" }).click()
    const filled = parseUnits(await page.locator("#borrow-loan").inputValue(), 6)
    // With no existing debt or pending collateral, Max fills the contract capacity exactly.
    expect(filled).toBe(capacity)
    await page.locator("#borrow-loan").fill("")
    I.journey.capacity = capacity
    I.observe("chk_borrow_capacity_matches", `Borrow shows "Can borrow ${shown} USDG" (Max fills ${formatUnits(filled, 6)}) in the ${session} session; chain: ${I.nvdax(assets)} × relayed ${I.usd(price)} = ${I.usdg(value)} × max LTV ${I.pct(maxLtv)} = ${formatUnits(capacity, 6)} USDG (= MarketLens.borrowCapacity). The screen's figure equals the contract capacity (no debt or pending-collateral margin); the session limit binds (cap room ${I.usdg(capRoom)}, idle ${I.usdg(v.idle)})`)
    // <<< abel:borrow_capacity
  })
  step("borrow_borrow", "Borrow USDG within the limit", async ({ page }) => {
    // action:   Enter an amount within capacity, borrow and sign.
    // expected: The borrow succeeds, links to the explorer, and the wallet's USDG balance and debt rise by the amount.
    // >>> abel:borrow_borrow
    const I = await import("./_intatto"), { expect } = I, abi = await import("@intatto/config/abi")
    const { formatUnits } = await import("viem")
    const { f, fork, d, nvda } = I.forkAccess()
    const L = await I.lens(fork.client as never, d, f.burnerAddress)
    const burner = f.burnerAddress
    const form = page.getByTestId("deposit-borrow-form"), cta = form.locator('[data-slot="form-cta"] button')
    const capacity = I.journey.capacity as bigint
    await I.edge("ec_borrow_session_limit", async () => {
      const nonce = await fork.client.getTransactionCount({ address: burner })
      const debt = (await L.account()).debt
      const over = capacity + 1_000_000n
      await page.locator("#borrow-loan").fill(formatUnits(over, 6))
      await expect(cta).toHaveText("Refused: SessionLimit", { timeout: 45_000 })
      await expect(cta).toBeDisabled()
      await expect(form).toContainText("The contract refused this in a simulation. Nothing was signed or sent.")
      const sim = await fork.client.simulateContract({ address: nvda.market as never, abi: abi.collateralMarketAbi, functionName: "borrow", args: [over], account: burner }).then(() => "accepted", (e: Error) => e.message)
      expect(sim).toContain("SessionLimit")
      expect(await fork.client.getTransactionCount({ address: burner })).toBe(nonce)
      expect((await L.account()).debt).toBe(debt)
      await page.locator("#borrow-loan").fill("")
      return `Typed ${I.usdg(over)} (1 USDG over the session limit): button "Refused: SessionLimit" (disabled) with "The contract refused this in a simulation. Nothing was signed or sent."; eth_call borrow(${over}) from the burner reverts SessionLimit; burner nonce stayed ${nonce}; debt stayed ${debt}`
    })
    const before = await L.account()
    const loan = ((capacity * 8n) / 10n / 1_000_000n) * 1_000_000n
    await page.locator("#borrow-loan").fill(formatUnits(loan, 6))
    await expect(cta).toHaveText("Review", { timeout: 60_000 })
    await cta.click()
    const review = page.getByTestId("borrow-review")
    await review.getByRole("button", { name: `Borrow ${I.usdg(loan)}` }).click({ timeout: 60_000 })
    const done = review.getByTestId("review-done-step").filter({ hasText: "Borrowed" })
    await expect(done).toContainText(`Borrowed ${I.usdg(loan)}`, { timeout: 60_000 })
    const hash = (await done.locator('[data-slot="explorer-link"]').getAttribute("title")) as `0x${string}`
    const r = await fork.client.getTransactionReceipt({ hash })
    expect([r.status, r.from.toLowerCase(), r.to?.toLowerCase()]).toEqual(["success", burner.toLowerCase(), nvda.market.toLowerCase()])
    await expect(review.getByTestId("review-finished")).toBeVisible({ timeout: 60_000 })
    const after = await L.account()
    expect(after.walletUsdg - before.walletUsdg).toBe(loan)
    expect(after.debt - before.debt >= loan && after.debt - before.debt < loan + 10_000n).toBe(true)
    const shownDebt = await I.shows("debt", async () => (await page.getByTestId("position-debt").innerText()).split("\n").pop() ?? null, async () => I.usdg((await L.account()).debt))
    I.journey.loan = loan
    I.observe("chk_borrow_tx", `Borrow ${I.usdg(loan)} (80% of capacity) confirmed: ${hash} from the burner to the market, listed as "Borrowed ${I.usdg(loan)} · Confirmed · ${hash.slice(0, 8)}…" (hash as text on the fork, OKLink on X Layer)`)
    I.observe("chk_borrow_debt", `Wallet USDG ${I.usdg(before.walletUsdg)} → ${I.usdg(after.walletUsdg)} (+${formatUnits(after.walletUsdg - before.walletUsdg, 6)}); debt ${before.debt} → ${after.debt} base units (+${formatUnits(after.debt - before.debt, 6)}: the ${formatUnits(loan, 6)} borrowed plus ${after.debt - before.debt - loan} base units of interest accrued since the borrow block); position panel debt "${shownDebt}"`)
    I.observeCall("int_borrow_call", `CollateralMarket.borrow(${loan}) confirmed, status success; debt recorded ${formatUnits(after.debt, 6)} USDG`, hash)
    // <<< abel:borrow_borrow
  })
  step("borrow_health", "Read health and the Monday-gap table", async ({ page }) => {
    // action:   Read debt, LTV, health, the liquidation price and the Monday-gap table.
    // expected: Debt includes accrued interest; LTV, health and the liquidation price agree with contract reads; the table lists the Monday-open drops that would liquidate the position and whether lenders would lose.
    // >>> abel:borrow_health
    const I = await import("./_intatto"), { expect } = I
    const { edgeBadPrice, edgeWithdrawUnhealthy, edgeTickerCap, gapRowsMatch } = await import("./_intatto_borrow")
    const { f, fork, d } = I.forkAccess()
    const L = await I.lens(fork.client as never, d, f.burnerAddress)
    await page.getByTestId("borrow-review").getByRole("button", { name: "Back to the form" }).click()
    await I.edge("ec_borrow_bad_price", () => edgeBadPrice(page))
    await I.edge("ec_withdraw_unhealthy", () => edgeWithdrawUnhealthy(page))
    await I.edge("ec_borrow_ticker_cap", () => edgeTickerCap(page))
    const loan = I.journey.loan as bigint
    const panel = async () => {
      const t = async (id: string) => (await page.getByTestId(id).innerText()).split("\n").pop()!.trim()
      return [await t("position-debt"), await t("position-ltv"), await t("position-health"), await t("position-liq-price")].join(" | ")
    }
    const want = async () => {
      const a = await L.account()
      return [I.usdg(a.debt), I.pct(a.ltvBps), I.health(a.healthFactorE18), I.usd(a.liquidationPriceE18)].join(" | ")
    }
    const shown = await I.shows("debt, LTV, health, liquidation price", panel, want)
    const a = await L.account()
    expect(a.debt).toBeGreaterThan(loan)
    I.observe("chk_borrow_health_values", `Position panel "${shown}" (debt | LTV | health | liquidation price) = MarketLens.account at the same block; debt ${a.debt} base units vs ${loan} borrowed: +${a.debt - loan} accrued interest over the ~31 minutes of chain time the stale-price edge case moved`)
    const rows = await gapRowsMatch(page)
    // The step's last clause: the table must say whether lenders would lose at each drop.
    await expect(page.getByTestId("gap-table"), "the Monday-gap table says whether lenders would lose").toContainText(/lender/i, { timeout: 5_000 })
    I.observe("chk_borrow_gap_table", `Gap rows ${rows.join(" / ")} match the contract's liquidation test on MarketLens values; the table says whether lenders would lose`)
    // <<< abel:borrow_health
  })
  step("borrow_repay", "Repay in full", async ({ page }) => {
    // action:   Repay the whole debt.
    // expected: Repay succeeds and links to the explorer; debt shows zero.
    // >>> abel:borrow_repay
    const { repayAll } = await import("./_intatto_borrow")
    await repayAll(page)
    // <<< abel:borrow_repay
  })
  step("borrow_withdraw", "Withdraw the collateral", async ({ page }) => {
    // action:   Withdraw all the collateral.
    // expected: Withdraw succeeds and links to the explorer; Borrow returns to no position.
    // >>> abel:borrow_withdraw
    const { withdrawAll } = await import("./_intatto_borrow")
    await withdrawAll(page)
    // <<< abel:borrow_withdraw
  })
})
