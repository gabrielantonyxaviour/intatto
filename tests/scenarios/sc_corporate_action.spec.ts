/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_corporate_action
 *  mapping:    2
 *  definition: 36308d0d79e9fc99605286478c9d979aaf8bc3ebe4a87376d1951ca5adcf90ae
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_corporate_action", "judge", () => {
  step("ca_replay", "Replay the activation", async ({ page }) => {
    // action:   On Sandbox, replay a corporate-action activation.
    // expected: The replay starts, and the ledger lists it with its source.
    // >>> abel:ca_replay
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox"), B = await import("./_intatto_borrow")
    const { corporateActionGuardAbi } = await import("@intatto/config/abi")
    // The judge's own session with a small open loan first, so the pause can show that repaying stays open.
    const { stored } = await SB.startSessionOnScreen(page)
    await SB.go(page, "Borrow")
    await expect(page.getByTestId("position-empty")).toBeVisible({ timeout: 120_000 })
    const pos = await B.depositAndBorrow(page, "4", "Low")
    await SB.go(page, "Sandbox")
    await expect(page.getByTestId("scenarios")).toBeVisible({ timeout: 120_000 })
    const { client, nvda } = await SB.sessionChain()
    const { status, body } = await SB.adminAction(page, "Schedule a 10-for-1 split", "scenario")
    expect(status).toBe(200)
    const entries = await SB.ledgerMatchesApi(page)
    const started = entries.find((e) => e.kind === "scenario" && e.summary.startsWith("scenario corporate-action started"))!
    const pending = entries.find((e) => e.summary.startsWith("corporate action pending"))!
    expect(Boolean(started && pending)).toBe(true)
    const sources = started.detail!.sources as { url: string; retrievedAt: string; sha256: string }[]
    expect(sources.length).toBeGreaterThan(0)
    const row = page.getByTestId("ledger-row").filter({ hasText: started.summary })
    await row.locator("summary").click()
    for (const s of sources) await expect(row).toContainText(s.url)
    await expect(row).toContainText(`retrieved ${sources[0]!.retrievedAt}`)
    const read = <T,>(functionName: string) => client.readContract({ address: nvda.corporateActionGuard as `0x${string}`, abi: corporateActionGuardAbi, functionName } as never) as Promise<T>
    expect(await read<boolean>("isPaused")).toBe(true)
    const action = await read<{ activationAt: bigint; expectedMultiplier: bigint; preActionMultiplier: bigint; preActionPrice: bigint; active: boolean }>("pendingAction")
    I.journey.action = action
    I.observe("chk_ca_replay_ledger", `Setup: session ${stored.sessionId}, 4 NVDAx deposited and ${I.usdg(pos.loan)} borrowed (${pos.borrowHash}). "Schedule a 10-for-1 split: done"; the ledger (= GET /session/:id/ledger, ${entries.length} entries) lists "${started.summary}" whose Details show ${sources.map((s) => `${s.url} · retrieved ${s.retrievedAt} · sha256 ${s.sha256.slice(0, 12)}…`).join("; ")}, then "${pending.summary}"; CorporateActionGuard.isPaused() = true`)
    I.observeCall("int_ca_replay", `POST /session/${stored.sessionId}/scenario {"name":"corporate-action"} → ${status}; ${body.entries.length} ledger entries written`)
    // <<< abel:ca_replay
  })
  step("ca_risk_window", "Read the window on the Risk console", async ({ page }) => {
    // action:   Open the Risk console.
    // expected: The Risk console is in the corporate-action state and shows the multiplier before and after and the pause window.
    // >>> abel:ca_risk_window
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox")
    const { corporateActionGuardAbi } = await import("@intatto/config/abi")
    const { formatTokenAmount, formatUtc } = await import("../../web/components/ui/web3/format.ts")
    await SB.go(page, "Risk")
    await expect(page.getByTestId("risk-console")).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId("guard-alert").locator('[data-guard="CorporateActionPending"]')).toBeVisible({ timeout: 60_000 })
    await page.getByRole("navigation", { name: "Risk analyses" }).getByRole("link", { name: "Corporate actions", exact: true }).click()
    await expect(page.getByTestId("risk-console")).toHaveAttribute("data-view", "actions")
    const pa = page.getByTestId("pending-action")
    await expect(pa).toBeVisible({ timeout: 60_000 })
    const { client, nvda } = await SB.sessionChain()
    const read = <T,>(functionName: string) => client.readContract({ address: nvda.corporateActionGuard as `0x${string}`, abi: corporateActionGuardAbi, functionName } as never) as Promise<T>
    const a = await read<{ activationAt: bigint; expectedMultiplier: bigint; preActionMultiplier: bigint }>("pendingAction")
    const [windowStart] = await read<readonly [bigint, bigint]>("pauseWindow")
    const mult = (v: bigint) => `${formatTokenAmount(v, 18, { maxFractionDigits: 4, minFractionDigits: 4 })}×`
    await expect(pa).toContainText(mult(a.preActionMultiplier))
    await expect(pa).toContainText(mult(a.expectedMultiplier))
    const windowText = `From ${formatUtc(windowStart)} until a consistent post after ${formatUtc(a.activationAt).slice(11, 19)} UTC`
    await expect(pa).toContainText(windowText)
    await expect(pa).toContainText("paused")
    I.observe("chk_ca_window_shown", `Risk console: guard alert lists CorporateActionPending; Corporate actions › Pending action: multiplier ${mult(a.preActionMultiplier)} → ${mult(a.expectedMultiplier)} (= pendingAction().preActionMultiplier → expectedMultiplier), activation ${formatUtc(a.activationAt)}, "Pause window: ${windowText}" (= pauseWindow() start), "Paused now: paused"`)
    // <<< abel:ca_risk_window
  })
  step("ca_borrow_paused", "Borrow inside the window", async ({ page }) => {
    // action:   On Borrow, try to borrow.
    // expected: The borrow is refused with CorporateActionPending; repay stays available.
    // >>> abel:ca_borrow_paused
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox"), B = await import("./_intatto_borrow")
    await SB.go(page, "Borrow")
    await expect(page.getByTestId("market-status")).toContainText("a split or dividend is being applied", { timeout: 60_000 })
    const { nonce, simulate } = await B.borrowAccess()
    const n0 = await nonce()
    await page.locator("#borrow-loan").fill("1")
    await expect(B.borrowCta(page)).toHaveText("Refused: CorporateActionPending", { timeout: 60_000 })
    await expect(B.borrowCta(page)).toBeDisabled()
    await expect(B.borrowForm(page)).toContainText("Nothing was signed or sent")
    const sim = await simulate("borrow", [1_000_000n])
    expect(sim).toContain("CorporateActionPending")
    await page.locator("#borrow-loan").fill("")
    await page.getByRole("tab", { name: "Repay & withdraw" }).click()
    await expect(B.repayForm(page)).toContainText("Repaying never depends on the price or the market session")
    await page.locator("#repay-amount").fill("1")
    await expect(B.repayCta(page)).toHaveText("Review", { timeout: 45_000 })
    await expect(B.repayCta(page)).toBeEnabled()
    await page.locator("#repay-amount").fill("")
    await page.getByRole("tab", { name: "Deposit & borrow" }).click()
    expect(await nonce()).toBe(n0)
    I.observe("chk_ca_borrow_paused", `Borrow shows "New borrowing is paused … a split or dividend is being applied"; typing 1 USDG: "Refused: CorporateActionPending" (disabled), "Nothing was signed or sent"; eth_call borrow(1 USDG) reverts CorporateActionPending; a 1 USDG repay still reaches "Review" ("Repaying never depends on the price or the market session"); burner nonce stayed ${n0}`)
    I.observeCall("int_ca_refused", `eth_call CollateralMarket.borrow(1000000) from the burner reverts CorporateActionPending; nothing sent`)
    // <<< abel:ca_borrow_paused
  })
  step("ca_past_activation", "Move past activation", async ({ page }) => {
    // action:   Jump past the activation time.
    // expected: Sandbox is in the warped state; the post-activation price is posted.
    // >>> abel:ca_past_activation
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox")
    const { corporateActionGuardAbi, priceRelayAdapterAbi } = await import("@intatto/config/abi")
    await SB.go(page, "Sandbox")
    await expect(page.getByTestId("scenarios")).toBeVisible({ timeout: 120_000 })
    const { client, nvda, s } = await SB.sessionChain()
    const action = I.journey.action as { activationAt: bigint; preActionPrice: bigint }
    const { status, body } = await SB.adminAction(page, "Activate the split", "scenario")
    expect(status).toBe(200)
    const t = await SB.bannerTimeMatchesRpc(page, client)
    expect(t).toBeGreaterThan(Number(action.activationAt))
    const [price, fetchedAt] = (await client.readContract({ address: nvda.priceRelay as `0x${string}`, abi: priceRelayAdapterAbi, functionName: "latestPrice" } as never)) as [bigint, bigint]
    expect(Number(fetchedAt)).toBeGreaterThanOrEqual(Number(action.activationAt))
    const drift = price * 10n > action.preActionPrice ? price * 10n - action.preActionPrice : action.preActionPrice - price * 10n
    expect(drift * 100n <= action.preActionPrice * 2n).toBe(true)
    expect(await client.readContract({ address: nvda.corporateActionGuard as `0x${string}`, abi: corporateActionGuardAbi, functionName: "isPaused" } as never)).toBe(false)
    const entries = await SB.ledgerMatchesApi(page)
    const warp = entries.filter((e) => e.kind === "warp").at(-1)!
    const done = entries.find((e) => e.summary.startsWith("corporate action activated"))!
    expect(warp.summary).toContain("past the multiplier activation")
    expect(done.summary).toContain("accepted")
    const iso = (x: number | bigint) => new Date(Number(x) * 1000).toISOString()
    I.observe("chk_ca_post_price", `"Activate the split: done"; banner chain time ${iso(t)} (= latest block) is past activation ${iso(action.activationAt)}; ledger rows "${warp.summary}" and "${done.summary}"; relay latestPrice ${I.usd(price)} fetched ${iso(fetchedAt)} (after activation) = the pre-action ${I.usd(action.preActionPrice)} ÷ 10 within 2%; CorporateActionGuard.isPaused() = false`)
    I.observeCall("int_ca_warp", `POST /session/${s.sessionId}/scenario {"name":"corporate-action-activate"} → ${status}; chain time ${body.chain ? iso(body.chain.chainTime) : "–"}, ${body.entries.length} ledger entries`)
    // <<< abel:ca_past_activation
  })
  step("ca_borrow_resumes", "Borrow resumes", async ({ page }) => {
    // action:   On Borrow, borrow again.
    // expected: The borrow succeeds; the Risk console no longer shows the window as active.
    // >>> abel:ca_borrow_resumes
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox"), B = await import("./_intatto_borrow")
    const { corporateActionGuardAbi } = await import("@intatto/config/abi")
    await SB.go(page, "Borrow")
    await expect(page.getByTestId("borrow-screen")).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId("market-status")).toHaveCount(0, { timeout: 60_000 })
    const { client, nvda, L, s, d } = await SB.sessionChain()
    const m = await L.market()
    await expect(page.getByTestId("relayed-price").first()).toHaveText(I.usd(m.priceE18), { timeout: 60_000 })
    const before = await L.account()
    await page.locator("#borrow-loan").fill("1")
    await expect(B.borrowCta(page)).toHaveText("Review", { timeout: 60_000 })
    await B.borrowCta(page).click()
    const review = page.getByTestId("borrow-review")
    await review.getByRole("button", { name: "Borrow 1.00 USDG" }).click({ timeout: 60_000 })
    const doneRow = review.getByTestId("review-done-step").filter({ hasText: "Borrowed 1.00 USDG" })
    await expect(doneRow).toBeVisible({ timeout: 60_000 })
    const hash = (await doneRow.locator('[data-slot="explorer-link"]').getAttribute("title")) as `0x${string}`
    const r = await client.getTransactionReceipt({ hash })
    expect(r.status).toBe("success")
    const after = await L.account()
    expect(after.debt - before.debt >= 1_000_000n).toBe(true)
    await review.getByRole("button", { name: "Back to the form" }).click()
    await SB.go(page, "Risk")
    await page.getByRole("navigation", { name: "Risk analyses" }).getByRole("link", { name: "Corporate actions", exact: true }).click()
    await expect(page.getByText("No split or dividend is scheduled.")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId("pending-action")).toHaveCount(0)
    await expect(page.locator('[data-guard="CorporateActionPending"]')).toHaveCount(0)
    const nothing = (await page.getByText("No split or dividend is scheduled.").innerText()).replace(/\s+/g, " ")
    I.observe("chk_ca_borrow_resumes", `Borrow: no pause notice, relayed price ${I.usd(m.priceE18)} (post-split); borrowing 1.00 USDG confirmed ${hash} (block ${r.blockNumber}), debt ${I.usdg(before.debt)} → ${I.usdg(after.debt)}. Risk console › Corporate actions: "${nothing}" with no pending-action panel and no CorporateActionPending guard alert`)
    I.observeCall("int_ca_borrow", `CollateralMarket.borrow(1000000) confirmed after activation, status success`, hash)
    await I.edge("ec_ca_inconsistent_price", async () => {
      const { parseEventLogs } = await import("viem"), { priceRelayAdapterAbi, collateralMarketAbi, boundedLiquidatorAbi } = await import("@intatto/config/abi")
      const edgeStart = await client.getBlockNumber()
      const edgeNonce = await (await B.borrowAccess()).nonce()
      const REASONS = ["FutureFetch", "StaleFetch", "NotNewer", "UsdgStale", "UsdgOffPeg", "TwapUnavailable", "OutOfBand", "MaxMove"]
      await SB.go(page, "Sandbox")
      await expect(page.getByTestId("scenarios")).toBeVisible({ timeout: 120_000 })
      await SB.adminAction(page, "Schedule a 10-for-1 split", "scenario")
      const res = await SB.control("inconsistent-activation", s.sessionId)
      const post = (res.entries ?? []).filter((e) => e.summary.startsWith("keeper posted NVDAx quote")).at(-1)!
      const logs = parseEventLogs({ abi: priceRelayAdapterAbi, logs: (await client.getTransactionReceipt({ hash: post.txHash as `0x${string}` })).logs })
      const relayVerdict = logs.map((l) => (l.eventName === "PriceRejected" ? `PriceRejected(${REASONS[Number((l.args as { reason: number }).reason)]})` : l.eventName)).filter((x) => /^Price/.test(x)).join(", ") || "no relay event"
      const read = <T,>(functionName: string) => client.readContract({ address: nvda.corporateActionGuard as `0x${string}`, abi: corporateActionGuardAbi, functionName } as never) as Promise<T>
      const pendingAfter = await read<{ activationAt: bigint }>("pendingAction")
      const paused = await read<boolean>("isPaused")
      expect(paused).toBe(true)
      expect(Number((await client.getBlock({ blockTag: "latest" })).timestamp)).toBeGreaterThan(Number(pendingAfter.activationAt))
      const sim = await (await B.borrowAccess()).simulate("borrow", [1_000_000n])
      const name = sim.match(/Error: (\w+)\(/)?.[1] ?? "none"
      await SB.go(page, "Borrow")
      await page.locator("#borrow-loan").fill("1")
      // The label settles on the contract's own verdict once the simulation returns.
      await expect(B.borrowCta(page)).toHaveText(`Refused: ${name}`, { timeout: 60_000 })
      await page.locator("#borrow-loan").fill("")
      await SB.go(page, "Risk")
      const failing = async () => {
        const m = await L.market(), f: string[] = []
        if (!m.fresh) f.push("StalePrice")
        if (!m.inBand) f.push("PriceOutOfBand")
        if (!m.pegOk) f.push("UsdgOffPeg")
        if (m.corporateActionPaused) f.push("CorporateActionPending")
        return f.join(", ")
      }
      const shownGuards = await I.shows("Risk guard alert", async () => (await page.getByTestId("guard-alert").locator("[data-guard]").evaluateAll((els) => els.map((e) => e.getAttribute("data-guard")))).join(", "), failing)
      await page.getByRole("navigation", { name: "Risk analyses" }).getByRole("link", { name: "Corporate actions", exact: true }).click()
      await expect(page.getByTestId("pending-action")).toContainText("paused", { timeout: 60_000 })
      const facts = `A second 10-for-1 split was scheduled from Sandbox; then, through the session service and recorded in the ledger, the clock passed its activation and the keeper posted the pre-split quote (tx ${post.txHash}: the relay emitted ${relayVerdict}; the sandbox ledger calls it "${post.summary}"). CorporateActionGuard.isPaused() = ${paused}; Borrow shows "Refused: ${name}" for 1 USDG and eth_call borrow reverts ${name}; the Risk console's guard alert lists ${shownGuards} (= MarketLens flags) and Corporate actions still shows the pending action with "Paused now: paused"`
      expect(name).toBe("PriceOutOfBand")
      expect(await (await B.borrowAccess()).nonce()).toBe(edgeNonce)
      expect(pendingAfter.activationAt).toBeGreaterThan(0n)
      expect(await client.readContract({address: nvda.market as `0x${string}`, abi: collateralMarketAbi, functionName: "liquidationPaused"})).toBe(true)
      const slices = await client.getContractEvents({address: d.liquidator as `0x${string}`, abi: boundedLiquidatorAbi, eventName: "SliceExecuted", fromBlock: edgeStart + 1n, toBlock: "latest"})
      expect(slices.filter(x => x.args.market?.toLowerCase() === nvda.market.toLowerCase())).toHaveLength(0)
      return `${facts}; burner nonce unchanged ${edgeNonce}; pending action retained; liquidationPaused true; no NVDAx SliceExecuted since edge start`
    })
    // <<< abel:ca_borrow_resumes
  })
})
