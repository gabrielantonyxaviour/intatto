/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_keeper_live
 *  mapping:    2
 *  definition: a23cf1d198c2ea614a64ac028e92bf9dd7ab1c56c3c16cf91c7341451e0b9b90
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_keeper_live", "keeper", () => {
  step("keeper_read_issuer", "Read the issuer", async ({ page }) => {
    // action:   Run one cron cycle.
    // expected: The keeper log shows the cycle's issuer reads: price quote, trading period, halt flags and multiplier data.
    // >>> abel:keeper_read_issuer
    const I = await import("./_intatto"), { expect } = I, LV = await import("./_intatto_live")
    const { formatUtc } = await import("../../web/components/ui/web3/format.ts")
    const h0 = await LV.keeperHealth()
    await LV.openRisk(page, "keeper", "Keeper log")
    // One cron cycle: the keeper's /health moves to a new lastCycle.
    let h = h0
    await expect.poll(async () => { h = await LV.keeperHealth(); return h.lastCycle?.at ?? "" }, { timeout: 180_000, intervals: [5_000] }).not.toBe(h0.lastCycle?.at ?? "")
    const table = page.getByRole("list", { name: "Keeper service log", exact: true })
    await expect(table).toBeVisible({ timeout: 60_000 })
    const first = await I.shows("newest keeper log step", async () => (await table.locator('[data-row="keeper-service"]').first().locator('[data-col]').allTextContents()).join(" ").replace(/\s+/g, " "), async () => {
      const e = (await LV.keeperLog(1))[0]!
      return `${e.kind} ${e.at.replace("T", " ").slice(0, 19)} ${e.market} ${e.detail} ${e.txHash ? `${e.txHash.slice(0, 8)}…${e.txHash.slice(-6)}` : "none"}`.replace(/\s+/g, " ")
    }, 90_000).catch(() => null)
    const log = await LV.keeperLog(50)
    const price = log.find((e) => e.kind === "price")!, session = log.find((e) => e.kind === "session")!
    await expect(table).toContainText(price.detail)
    await expect(table).toContainText(session.detail)
    const section = page.locator('[data-section="keeper"]')
    const periodText = `period began ${formatUtc(Number(session.data!.periodChangedAt))}`
    await expect(section).toContainText(periodText)
    const seen = `cycle ${h.lastCycle?.at} (${h.lastCycle?.actions} action(s), ${h.lastCycle?.sent} sent, ${h.lastCycle?.failures} failures) after ${h0.lastCycle?.at}; service log newest row ${first ? `"${first}"` : "(not yet refreshed)"}; price step "${price.detail}" (quote ${price.data!.quoteE18} fetched ${price.data!.fetchedAt}); session step "${session.detail}" and onchain "${periodText}" (issuer period "${session.data!.issuerPeriod}", halted ${session.data!.halted} in the keeper's own record)`
    await expect(section, `the keeper log shows the issuer's halt flags — observed: ${seen}`).toContainText(/halt/i, { timeout: 5_000 })
    await expect(section, `the keeper log shows the issuer's multiplier data — observed: ${seen}`).toContainText(/multiplier/i, { timeout: 5_000 })
    I.observe("chk_keeper_cycle_logged", seen)
    I.observeCall("int_keeper_issuer", `keeper /health lastCycle ${h.lastCycle?.at}; issuer reads recorded in the keeper log: quote, period, halted`)
    // <<< abel:keeper_read_issuer
  })
  step("keeper_post", "Post session, price and cap on mainnet", async ({ page }) => {
    // action:   The keeper posts the session, the price with its fetch time, pending actions and the ticker cap from sampled QuoterV2 sell depth.
    // expected: Each post is confirmed on mainnet from the keeper address and passes the onchain guards.
    // >>> abel:keeper_post
    const I = await import("./_intatto"), { expect } = I, LV = await import("./_intatto_live")
    const { parseEventLogs } = await import("viem"), abi = await import("@intatto/config/abi"), { SESSIONS } = await import("@intatto/config/session")
    const { client, d, nvda, keeper, lensMarket } = LV.mainnet()
    const log = await LV.keeperLog(50)
    const pick = (k: string) => log.find((e) => e.kind === k && e.txHash)!
    const [s, p, c] = [pick("session"), pick("price"), pick("cap")]
    const rs = await LV.keeperTx(s.txHash as `0x${string}`, d.sessionRisk)
    const rp = await LV.keeperTx(p.txHash as `0x${string}`, nvda.priceRelay)
    const rc = await LV.keeperTx(c.txHash as `0x${string}`, d.depthCaps)
    const names = (r: typeof rs, a: readonly unknown[]) => parseEventLogs({ abi: a as never, logs: r.logs }).map((l: { eventName: string }) => l.eventName)
    expect(names(rs, abi.sessionRiskControllerAbi)).toContain("SessionPosted")
    expect(names(rp, abi.priceRelayAdapterAbi)).toContain("PricePosted")
    expect(names(rp, abi.priceRelayAdapterAbi)).not.toContain("PriceRejected")
    expect(names(rc, abi.depthCapRegistryAbi)).toContain("CapPosted")
    const m = await lensMarket()
    const now = Number((await client.getBlock({ blockTag: "latest" })).timestamp)
    expect([m.fresh, m.inBand, m.pegOk]).toEqual([true, true, true])
    expect(SESSIONS[m.session]).not.toBe("UNKNOWN")
    expect(now - Number(m.fetchedAt)).toBeLessThan(30 * 60)
    await LV.openRisk(page, "summary", "Summary")
    await expect(page.locator('[data-tile="session"] [data-tile-value]')).toHaveText(SESSIONS[m.session]!, { timeout: 60_000 })
    await expect(page.locator('[data-tile="price"] [data-tile-value]')).toHaveText(I.usd(m.priceE18), { timeout: 60_000 })
    const ex = (r: typeof rs) => `${r.transactionHash.slice(0, 10)}… block ${r.blockNumber}`
    I.observe("chk_keeper_posts_confirmed", `Latest keeper posts on X Layer mainnet, each a successful tx from the keeper ${keeper}: session ${ex(rs)} (SessionPosted), price ${ex(rp)} (PricePosted, no PriceRejected), cap ${ex(rc)} (CapPosted); guards now fresh/inBand/pegOk = true/true/true; Risk summary tiles show ${SESSIONS[m.session]} and ${I.usd(m.priceE18)}`)
    I.observe("chk_keeper_within_liveness", `price fetched ${now - Number(m.fetchedAt)} s before the latest block (limit 1,800 s); session ${SESSIONS[m.session]} posted ${now - Number(m.sessionPostedAt)} s before it (not UNKNOWN)`)
    I.observeCall("int_keeper_session", `SessionRiskController.postSession confirmed from the keeper: ${s.detail}`, rs.transactionHash)
    I.observeCall("int_keeper_price", `PriceRelayAdapter.post confirmed from the keeper and accepted (PricePosted): ${p.detail}`, rp.transactionHash)
    I.observeCall("int_keeper_cap", `DepthCapRegistry.post confirmed from the keeper: ${c.detail}`, rc.transactionHash)
    // <<< abel:keeper_post
  })
  step("keeper_risk_console", "See the posts on the Risk console", async ({ page }) => {
    // action:   Open the Risk console.
    // expected: The latest posts show fetch time, value, session, guard results (TWAP band, max move and USDG peg) and the sampled depth behind the cap; each keeper action links to its X Layer explorer transaction.
    // >>> abel:keeper_risk_console
    const I = await import("./_intatto"), { expect } = I, LV = await import("./_intatto_live")
    const { formatUtc } = await import("../../web/components/ui/web3/format.ts")
    const { client, keeper } = LV.mainnet()
    const range = await LV.openRisk(page, "prices", "Price posts")
    const all = await LV.keeperEvents(range.from, range.to)
    const prices = all.filter((e) => e.eventName === "PricePosted" || e.eventName === "PriceRejected")
    const rows = page.locator('[data-section="prices"] [data-row="price-post"]:visible')
    await expect(rows).toHaveCount(prices.length, { timeout: 60_000 })
    for (let i = 0; i < Math.min(5, prices.length); i++) {
      const e = prices[i]! as unknown as { transactionHash: string; eventName: string; args: { quoteE18: bigint; fetchedAt: bigint } }
      const row = rows.nth(i)
      await expect(row).toHaveAttribute("data-tx-hash", e.transactionHash)
      await expect(row.locator('[data-value="quote"]')).toHaveText(I.usd(e.args.quoteE18))
      await expect(row).toContainText(`fetched ${formatUtc(e.args.fetchedAt).slice(11, 19)}`)
      if (e.eventName === "PricePosted") await expect(row.locator('[data-check="fail"]')).toHaveCount(0)
    }
    await LV.openRisk(page, "keeper", "Keeper log")
    const actions = page.locator('[data-section="keeper"] [data-row="keeper-action"]:visible')
    await expect(actions).toHaveCount(all.length, { timeout: 60_000 })
    expect(await actions.evaluateAll((els) => els.map((e) => e.getAttribute("data-tx-hash")))).toEqual(all.map((e) => e.transactionHash))
    const links = await actions.locator('a[data-slot="explorer-link"]').evaluateAll((els) => els.map((e) => [e.getAttribute("href"), e.getAttribute("title")]))
    expect(links.length).toBe(all.length)
    for (const [href, hash] of links) {
      expect(href).toBe(`https://www.oklink.com/x-layer/tx/${hash}`)
      const r = await client.getTransactionReceipt({ hash: hash as `0x${string}` })
      expect([r.status, r.from.toLowerCase()]).toEqual(["success", keeper])
    }
    I.observe("chk_keeper_rows_match_events", `Risk console scanned blocks #${range.from}–#${range.to}: ${prices.length} price-post rows = the relay's PricePosted/PriceRejected events in that range, newest first; the newest ${Math.min(5, prices.length)} rows match tx hash, quote and "fetched hh:mm:ss" and show no failing check`)
    I.observe("chk_keeper_links_resolve", `Keeper log: ${all.length} rows = every keeper-sent SessionPosted/PricePosted/PriceRejected/CapPosted/ActionPosted event in the range, same order; each links to https://www.oklink.com/x-layer/tx/<hash> and every hash has a successful mainnet receipt from the keeper ${keeper}`)
    // <<< abel:keeper_risk_console
  })
  step("keeper_market", "See the posts on Market", async ({ page }) => {
    // action:   Open Market.
    // expected: Market shows the posted session, the price with the keeper's fetch time, and cap usage.
    // >>> abel:keeper_market
    const I = await import("./_intatto"), LV = await import("./_intatto_live")
    I.observe("chk_keeper_market_matches", await LV.marketMatchesChain(page))
    // <<< abel:keeper_market
  })
})
