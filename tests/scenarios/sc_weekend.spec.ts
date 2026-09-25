/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_weekend
 *  mapping:    2
 *  definition: c368281ca8e134d595012dd210db4beeb541c191a369f5738ed5167043788f7c
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_weekend", "judge", () => {
  step("weekend_start_session", "Start a sandbox session", async ({ page }) => {
    // action:   Open Sandbox and start a session.
    // expected: An active session with a burner address funded with NVDAx and USDG; the banner shows the fork block and sandbox chain time.
    // >>> abel:weekend_start_session
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox")
    const { erc20Abi } = await import("viem"), { TICKERS } = await import("@intatto/config/xlayer"), { SESSIONS } = await import("@intatto/config/session")
    const { formatTokenAmount } = await import("../../web/components/ui/web3/format.ts")
    const f = I.fixture("sandbox")
    const { status, created, stored } = await SB.startSessionOnScreen(page)
    expect(status).toBe(201)
    const { client, burner, d, L } = await SB.sessionChain(stored)
    expect(burner.toLowerCase()).toBe(created.burnerAddress.toLowerCase())
    await expect(page.getByTestId("sandbox-session").locator(`[title="${burner}"]`).first()).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId("burner-connection")).toContainText("Connected", { timeout: 60_000 })
    const nv = (await client.readContract({ address: TICKERS.NVDAx.token, abi: erc20Abi, functionName: "balanceOf", args: [burner] })) as bigint
    const us = (await client.readContract({ address: d.usdg as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [burner] })) as bigint
    expect(nv > 0n && us > 0n).toBe(true)
    const shownNv = formatTokenAmount(nv, 18, { maxFractionDigits: 4 }), shownUs = formatTokenAmount(us, 6, { maxFractionDigits: 2 })
    await expect(page.getByTestId("balance-NVDAx")).toHaveText(shownNv, { timeout: 60_000 })
    await expect(page.getByTestId("balance-USDG")).toHaveText(shownUs)
    const banner = page.locator('[data-slot="sandbox-banner"]')
    await expect(banner).toContainText(`fork of X Layer mainnet at block ${f.forkBlock} · chain ${f.chainId}`)
    const t = await SB.bannerTimeMatchesRpc(page, client)
    const session = SESSIONS[(await L.market()).session]!
    await expect(page.getByTestId("market-session")).toHaveText(session, { timeout: 60_000 })
    const bannerText = (await banner.innerText()).replace(/\s+/g, " ").replace("Exit sandbox", "").trim()
    I.observe("chk_weekend_session", `Session ${stored.sessionId} active (POST /session → ${status}); banner "${bannerText}" with <time> = latest block timestamp ${new Date(t * 1000).toISOString()}; market session ${session}`)
    I.observe("chk_weekend_burner_funded", `Burner ${burner} on the session card, "Connected"; balances NVDAx ${shownNv} and USDG ${shownUs} = balanceOf through the session's public RPC (${stored.rpcUrl})`)
    I.observeCall("int_weekend_session", `POST ${f.apiUrl}/session → ${status}: session ${created.sessionId}, rpc ${created.rpcUrl}, burner ${created.burnerAddress}, ${created.entries.length} ledger entries at start`)
    // <<< abel:weekend_start_session
  })
  step("weekend_borrow_weekday", "Borrow on a weekday", async ({ page }) => {
    // action:   On Borrow in the sandbox, deposit NVDAx and borrow USDG within the OPEN limit.
    // expected: Deposit and borrow succeed against the fork; the position is healthy.
    // >>> abel:weekend_borrow_weekday
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox"), B = await import("./_intatto_borrow")
    const { SESSIONS } = await import("@intatto/config/session")
    await SB.go(page, "Borrow")
    await expect(page.getByTestId("borrow-screen")).toBeVisible({ timeout: 120_000 })
    const { L } = await SB.sessionChain()
    const m = await L.market()
    const session = SESSIONS[m.session]!
    expect(["OPEN", "EXTENDED"]).toContain(session)
    await expect(page.getByTestId("position-empty")).toBeVisible({ timeout: 60_000 })
    const r = await B.depositAndBorrow(page, "5", "Medium")
    const a = r.account
    expect(a.ltvBps > 0n && a.ltvBps <= m.maxLtvBps).toBe(true)
    expect(a.healthFactorE18 > 10n ** 18n).toBe(true)
    const shown = await I.shows("LTV and health", async () => `${(await page.getByTestId("position-ltv").innerText()).split("\n").pop()} | ${(await page.getByTestId("position-health").innerText()).split("\n").pop()}`, async () => {
      const x = await L.account()
      return `${I.pct(x.ltvBps)} | ${I.health(x.healthFactorE18)}`
    })
    I.journey.weekday = { session, maxLtvBps: m.maxLtvBps, ltvBps: a.ltvBps }
    I.observe("chk_weekend_weekday_borrow", `Weekday session ${session} (max new-borrow LTV ${I.pct(m.maxLtvBps)}; the OPEN limit is 50%): deposited 5 NVDAx (${r.depositHash}, block ${r.depositBlock}) and borrowed ${I.usdg(r.loan)} at the Medium chip (${r.borrowHash}, block ${r.borrowBlock}), both confirmed from the burner on the fork; position LTV ${I.pct(a.ltvBps)} ≤ ${I.pct(m.maxLtvBps)}, health ${I.health(a.healthFactorE18)} > 1; panel "${shown}"`)
    I.observeCall("int_weekend_deposit", `CollateralMarket.addCollateral(5 NVDAx) confirmed on the sandbox fork`, r.depositHash)
    I.observeCall("int_weekend_borrow", `CollateralMarket.borrow(${r.loan}) confirmed on the sandbox fork`, r.borrowHash)
    // <<< abel:weekend_borrow_weekday
  })
  step("weekend_warp", "Jump to Saturday", async ({ page }) => {
    // action:   Use the jump to the next market close.
    // expected: Sandbox is in the warped state and the banner's chain time is after the close.
    // >>> abel:weekend_warp
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox")
    const { nextWeekendClose } = await import("../../checks/fork/lib/clock.ts")
    await SB.go(page, "Sandbox")
    await expect(page.getByTestId("time-travel")).toBeVisible({ timeout: 120_000 })
    const { client, s } = await SB.sessionChain()
    const before = Number((await client.getBlock({ blockTag: "latest" })).timestamp)
    const close = nextWeekendClose(before)
    const { status, body } = await SB.adminAction(page, "Jump to Saturday", "warp")
    expect(status).toBe(200)
    const t = await SB.bannerTimeMatchesRpc(page, client)
    expect(t).toBeGreaterThan(close)
    expect(new Date(t * 1000).getUTCDay()).toBe(6)
    await expect(page.getByTestId("market-session")).toHaveText("CLOSED", { timeout: 60_000 })
    const result = (await page.getByTestId("action-result").innerText()).replace(/\s+/g, " ")
    const iso = (x: number) => new Date(x * 1000).toISOString()
    I.observe("chk_weekend_warp_time", `"${result}"; banner chain time ${iso(t)} (= latest block) is a Saturday after the Friday 20:00 ET close ${iso(close)} (chain time before the jump ${iso(before)}); session badge CLOSED = currentSession()`)
    I.observeCall("int_weekend_warp", `POST /session/${s.sessionId}/warp {"target":"saturday"} → ${status}; answered chain time ${body.chain ? iso(body.chain.chainTime) : "–"}, session ${body.chain?.session ?? "–"}, ${body.entries.length} ledger entries`)
    // <<< abel:weekend_warp
  })
  step("weekend_borrow_refused", "See capacity drop and a borrow refused", async ({ page }) => {
    // action:   On Borrow, read the capacity and try to borrow more.
    // expected: Capacity has dropped to the CLOSED limit; the borrow is refused with SessionLimit; repay stays available.
    // >>> abel:weekend_borrow_refused
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox"), B = await import("./_intatto_borrow")
    const { SESSIONS } = await import("@intatto/config/session")
    await SB.go(page, "Borrow")
    await expect(page.getByTestId("session-badge")).toHaveText("CLOSED", { timeout: 60_000 })
    const { L } = await SB.sessionChain()
    const { nonce, simulate } = await B.borrowAccess()
    const [m, a] = await Promise.all([L.market(), L.account()])
    expect(SESSIONS[m.session]).toBe("CLOSED")
    const weekday = I.journey.weekday as { session: string; maxLtvBps: bigint; ltvBps: bigint }
    expect(m.maxLtvBps).toBeLessThan(weekday.maxLtvBps)
    await expect(page.getByTestId("session-max-ltv").first()).toHaveText(I.pct(m.maxLtvBps))
    expect(a.ltvBps).toBeGreaterThan(m.maxLtvBps)
    expect(a.borrowCapacity).toBe(0n)
    const cap = await B.canBorrowShown(page)
    expect((await import("viem")).parseUnits(cap.replace(/,/g, "").replace(/ USDG$/, ""), 6)).toBe(a.borrowCapacity)
    const n0 = await nonce()
    await page.locator("#borrow-loan").fill("10")
    await expect(B.borrowCta(page)).toHaveText("Refused: SessionLimit", { timeout: 60_000 })
    await expect(B.borrowCta(page)).toBeDisabled()
    await expect(B.borrowForm(page)).toContainText("The contract refused this in a simulation. Nothing was signed or sent.")
    const sim = await simulate("borrow", [10_000_000n])
    expect(sim).toContain("SessionLimit")
    await page.locator("#borrow-loan").fill("")
    await page.getByRole("tab", { name: "Repay & withdraw" }).click()
    await expect(B.repayForm(page)).toContainText("Repaying never depends on the price or the market session")
    await page.locator("#repay-amount").fill("1")
    await expect(B.repayCta(page)).toHaveText("Review", { timeout: 45_000 })
    await expect(B.repayCta(page)).toBeEnabled()
    await page.locator("#repay-amount").fill("")
    expect(await nonce()).toBe(n0)
    const reason = sim.match(/SessionLimit\([^)]*\)/)?.[0] ?? "SessionLimit"
    I.observe("chk_weekend_capacity_drop", `Borrow on Saturday: badge CLOSED, max new-borrow LTV ${I.pct(m.maxLtvBps)} (= maxLtvBps(); it was ${I.pct(weekday.maxLtvBps)} in ${weekday.session} when the loan was taken); the position's LTV ${I.pct(a.ltvBps)} is above it, so the screen shows "Can borrow ${cap}" = MarketLens.borrowCapacity ${a.borrowCapacity}`)
    I.observe("chk_weekend_session_limit", `Typing 10 USDG: "Refused: SessionLimit" (disabled) and "The contract refused this in a simulation. Nothing was signed or sent."; eth_call borrow(10 USDG) reverts ${reason}; burner nonce stayed ${n0}. Repay & withdraw still reaches "Review" for a 1 USDG repay ("Repaying never depends on the price or the market session")`)
    I.observeCall("int_weekend_refused", `eth_call CollateralMarket.borrow(10000000) from the burner reverts ${reason}; nothing was sent (nonce ${n0})`)
    // <<< abel:weekend_borrow_refused
  })
  step("weekend_repay", "Repay on Saturday", async ({ page }) => {
    // action:   Repay the debt.
    // expected: Repay succeeds on Saturday and links to its transaction; debt falls.
    // >>> abel:weekend_repay
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox"), B = await import("./_intatto_borrow")
    const { client, L } = await SB.sessionChain()
    const owed = (await L.account()).debt
    const hash = await B.repayAll(page, { tx: "chk_weekend_repay", zero: "chk_weekend_repay", call: "int_weekend_repay" })
    const r = await client.getTransactionReceipt({ hash })
    const when = Number((await client.getBlock({ blockNumber: r.blockNumber })).timestamp)
    expect(new Date(when * 1000).getUTCDay()).toBe(6)
    expect((await L.account()).debt).toBeLessThan(owed)
    I.observe("chk_weekend_repay", `the repay's block time ${new Date(when * 1000).toISOString()} is a Saturday (session CLOSED); debt fell from ${I.usdg(owed)} to ${I.usdg((await L.account()).debt)}`)
    // <<< abel:weekend_repay
  })
  step("weekend_risk_session", "See the CLOSED session on the Risk console", async ({ page }) => {
    // action:   Open the Risk console in the sandbox.
    // expected: The session timeline shows CLOSED with the LTV for that state.
    // >>> abel:weekend_risk_session
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox")
    await SB.go(page, "Risk")
    await expect(page.getByTestId("risk-console")).toBeVisible({ timeout: 120_000 })
    await page.getByRole("navigation", { name: "Risk analyses" }).getByRole("link", { name: "Sessions", exact: true }).click()
    await expect(page.getByTestId("risk-console")).toHaveAttribute("data-view", "sessions")
    const { L } = await SB.sessionChain()
    const m = await L.market()
    const last = page.getByRole("list", { name: "Session timeline" }).locator("li").last()
    await expect(last).toContainText("CLOSED", { timeout: 60_000 })
    const now = page.locator("dl").filter({ hasText: "Max new-borrow LTV" }).first()
    await expect(now.locator('[data-session]')).toHaveText("CLOSED")
    await expect(now).toContainText(`${(Number(m.maxLtvBps) / 100).toFixed(2)}%`)
    const row = page.locator('[data-session-row="CLOSED"]')
    await expect(row).toHaveClass(/bg-muted/)
    const rowText = (await row.innerText()).replace(/\s+/g, " ").trim()
    const lastText = (await last.innerText()).replace(/\s+/g, " ").trim()
    I.observe("chk_weekend_risk_closed", `Risk console › Sessions: the timeline's latest run "${lastText}"; Now: CLOSED with max new-borrow LTV ${(Number(m.maxLtvBps) / 100).toFixed(2)}% (= maxLtvBps()); the highlighted current row reads "${rowText}"`)
    // <<< abel:weekend_risk_session
  })
  step("weekend_ledger", "Read the warp in the ledger", async ({ page }) => {
    // action:   Read the divergence ledger on Sandbox.
    // expected: The ledger lists the funding transfers and the warp for this session.
    // >>> abel:weekend_ledger
    const I = await import("./_intatto"), { expect } = I, SB = await import("./_intatto_sandbox")
    const { erc20Abi } = await import("viem"), { TICKERS } = await import("@intatto/config/xlayer")
    await SB.go(page, "Sandbox")
    await page.getByRole("button", { name: "View ledger", exact: true }).click()
    await expect(page.getByTestId("ledger")).toBeVisible({ timeout: 120_000 })
    const { burner, s } = await SB.sessionChain()
    const entries = await SB.ledgerMatchesApi(page)
    const funds = entries.filter((e) => e.kind === "fund" && String(e.detail?.to ?? "").toLowerCase() === burner.toLowerCase())
    const warp = entries.filter((e) => e.kind === "warp" && /Saturday/.test(e.summary))
    expect(funds.length).toBeGreaterThan(1)
    expect(warp.length).toBe(1)
    await expect(page.locator('[data-testid="ledger-row"][data-kind="warp"]').filter({ hasText: warp[0]!.summary })).toBeVisible()
    I.observe("chk_weekend_ledger_warp", `Ledger shows ${entries.length} entries, equal to GET /session/${s.sessionId}/ledger; funding to the burner: ${funds.map((e) => `"${e.summary}"`).join(", ")}; the warp: "${warp[0]!.summary}"`)
    await I.edge("ec_weekend_session_expiry", async () => {
      const old = I.journey.session as { sessionId: string; burnerKey: string }
      await SB.control("expire", old.sessionId)
      await page.reload()
      await expect(page.getByTestId("session-expired")).toContainText("Session expired", { timeout: 120_000 })
      await page.getByRole("button", { name: "Start a new session" }).click()
      let next = null as Awaited<ReturnType<typeof I.storedSandbox>>
      await expect(async () => {
        next = await I.storedSandbox(page)
        expect(next?.sessionId).toBeTruthy()
        expect(next?.sessionId).not.toBe(old.sessionId)
      }).toPass({ timeout: 180_000 })
      await expect(page.getByTestId("sandbox-session")).toBeVisible({ timeout: 120_000 })
      I.journey.session = next
      const c = await SB.sessionChain(next!)
      expect(next!.burnerKey).not.toBe(old.burnerKey)
      const nv = (await c.client.readContract({ address: TICKERS.NVDAx.token, abi: erc20Abi, functionName: "balanceOf", args: [c.burner] })) as bigint
      const us = (await c.client.readContract({ address: c.d.usdg as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [c.burner] })) as bigint
      expect(nv > 0n && us > 0n).toBe(true)
      await expect(page.getByTestId("sandbox-session").locator(`[title="${c.burner}"]`).first()).toBeVisible({ timeout: 60_000 })
      return `The session's chain was stopped as 30 idle minutes would (through the session service); after a reload Sandbox showed "Session expired" instead of the controls; "Start a new session" stored a new session ${next!.sessionId} (was ${old.sessionId}) with a new burner ${c.burner} funded with ${I.plain(nv, 18)} NVDAx and ${I.plain(us, 6)} USDG (balanceOf through its RPC)`
    })
    await I.edge("ec_weekend_unavailable", async () => {
      await page.getByRole("button", { name: "End session" }).click()
      await expect(page.getByTestId("start-session")).toBeVisible({ timeout: 60_000 })
      await page.goto("/sandbox?api=http://127.0.0.1:9")
      const alert = page.getByTestId("sandbox-unavailable")
      await expect(alert).toBeVisible({ timeout: 120_000 })
      await expect(page.getByRole("button", { name: "Start a session" })).toBeDisabled()
      await expect(page.getByTestId("sandbox-session")).toHaveCount(0)
      return `With the sandbox API's health check failing (API at http://127.0.0.1:9, nothing listening), Sandbox shows "${(await alert.innerText()).replace(/\s+/g, " ").slice(0, 220)}" and "Start a session" is disabled; no session card or controls are shown`
    })
    // <<< abel:weekend_ledger
  })
})
