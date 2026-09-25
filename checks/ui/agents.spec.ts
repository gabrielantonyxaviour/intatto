import { mkdir } from "node:fs/promises"
import type { Address } from "viem"
import { formatUnits } from "viem"
import { marketLensAbi, priceRelayAdapterAbi } from "@intatto/config/abi"
import { bpsShort, duration } from "../../web/components/market/format.ts"
import { sessionFromIndex } from "@intatto/config/session"
import { handleCredit } from "../../web/lib/credit/handler.ts"
import { openPosition } from "../fork/lib/scenarios.ts"
import { startForkHarness, type ForkHarness } from "../fork/harness.ts"
import { expect, expectNoHorizontalScroll, test, viewports } from "./fixtures"

// Several specs share checks/ui/.results and each run clears it. A trace file removed mid-run
// fails the test, so this spec keeps no trace. Evidence is proof/agents*.png and the assertions.
test.use({ trace: "off" })

let h: ForkHarness

test.beforeAll(async () => {
  h = await startForkHarness()
  await openPosition(h.ctx, h.env.burnerAddress, 2n * 10n ** 18n, 1_000)
  await mkdir("proof", { recursive: true })
}, 300_000)

test.afterAll(async () => {
  await h?.stop()
})

test("agents credit call matches the fork", async ({ page, useFork }) => {
  test.setTimeout(240_000)
  await useFork(page, h.env)
  await installCreditBridge(page)

  await page.setViewportSize(viewports.wide)
  await page.goto("/agents")
  await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Intatto credit and health" })).toBeVisible()
  await expect(page.getByLabel("Search services")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Add your API" })).toHaveCount(0)
  await expect(page.getByText("OKX AI listing: under review (agent #13907)")).toBeVisible()
  await expect(page.getByText("Verified 25 Sep 2026")).toBeVisible()
  await expect(page.getByText("Free", { exact: true }).first()).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/agents-catalog.png", fullPage: true })
  await page.setViewportSize(viewports.narrow)
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/agents-catalog-390.png", fullPage: true })
  await page.setViewportSize(viewports.wide)

  await page.getByRole("link", { name: "Try it" }).click()
  await expect(page).toHaveURL(/\/agents\/credit$/)
  await expect(page.getByRole("heading", { name: "Intatto credit and health" })).toBeVisible()
  await expect(page.getByText("OKX AI listing: under review (agent #13907)")).toBeVisible()
  await expect(page.getByText("Verified 25 Sep 2026")).toBeVisible()
  await expect(page.getByText("No paid receipt.")).toBeVisible()
  await expect(page.getByText("Registration is not listing approval.")).toBeVisible()
  await expect(page.getByText("x402 on X Layer (eip155:196) after a real paid settlement is proven")).toBeHidden()
  await expect(page.getByRole("link", { name: "see every keeper post on the Risk console" })).toBeVisible()
  await expect(page.getByTestId("credit-call-count")).toHaveText("0")
  expect(await page.locator("body").innerText()).not.toMatch(/listing: listed|listing approved/i)

  const api = page.locator("summary", { hasText: "API reference" })
  await expect(api).toBeVisible()
  await api.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Endpoints" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Parameters" })).toBeVisible()
  await expect(page.getByText("No client is wired up here.")).toBeVisible()
  await expect(page.getByText(/^curl -sS /)).toBeVisible()
  await api.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Endpoints" })).toBeHidden()

  const agent = page.getByRole("button", { name: "Agent details", exact: true })
  await agent.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("agent-details")).toBeVisible()
  await expect(page.getByText("Pay-to: none while the call is free.")).toBeVisible()
  await expect(page.getByRole("link", { name: "0xe1d2770368121cdc5457fcb6adaabdaedf57f7ecd804ca73916bfb0c1dc2b3c7" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("agent-details")).toBeHidden()

  const payment = page.getByRole("button", { name: "About Payment details" })
  await payment.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByText("x402 on X Layer (eip155:196) after a real paid settlement is proven")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByText("x402 on X Layer (eip155:196) after a real paid settlement is proven")).toBeHidden()

  await expect(page.getByLabel("Wallet")).toHaveValue(/^0x[0-9a-fA-F]{40}$/, { timeout: 60_000 })
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/credit?") && res.request().method() === "GET",
  )
  await page.getByRole("button", { name: "Try it" }).click()
  const response = await responsePromise
  const json = await response.json()
  const requestUrl = new URL(response.url())
  expect(requestUrl.searchParams.get("network")).toBe("sandbox")
  expect(requestUrl.searchParams.get("session")).toBe("local-check")
  expect(requestUrl.searchParams.get("market")).toBe("NVDAx")
  expect(requestUrl.searchParams.get("wallet")?.toLowerCase()).toBe(h.env.burnerAddress.toLowerCase())
  expect(json.service).toBe("intatto-credit")

  const market = h.deployment.markets.find((m) => m.symbol === "NVDAx")!
  const account = await h.fork.read<{ debt: bigint }>(h.deployment.lens as Address, marketLensAbi, "account", [
    market.market,
    h.env.burnerAddress,
  ])
  const posted = await h.fork.read<{ session: number }>(h.deployment.lens as Address, marketLensAbi, "market", [
    market.market,
  ])
  const session = sessionFromIndex(Number(posted.session))
  const debt = formatUnits(account.debt, 6)
  expect(json.session.state).toBe(session)
  expect(json.position.debtUsdg).toBe(debt)

  await expect(page.getByTestId("credit-session")).toHaveText(json.session.state)
  await expect(page.getByTestId("credit-debt")).toHaveText(json.position.debtUsdg)
  await expect(page.getByTestId("credit-capacity")).toHaveText(json.capacity.borrowableNowUsdg)
  await expect(page.getByTestId("credit-price")).toHaveCount(0)
  await expect(page.getByTestId("credit-call-count")).toHaveText("1")
  await expect(page.getByText("Stored in this browser only.")).toBeVisible()

  const relay = market.priceRelay as Address
  const [liveness, twap, peg] = await Promise.all([
    h.fork.read<bigint>(relay, priceRelayAdapterAbi, "priceLiveness"),
    h.fork.read<bigint>(relay, priceRelayAdapterAbi, "twapWindow"),
    h.fork.read<bigint>(relay, priceRelayAdapterAbi, "pegBps"),
  ])
  const responseDetails = page.getByRole("button", { name: "Response details", exact: true })
  await responseDetails.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("response-details")).toBeVisible()
  await expect(page.getByTestId("credit-price")).toHaveText(json.price.usdPerToken ?? "none")
  await expect(page.getByTestId("credit-fetched")).toHaveText(json.price.fetchedAt ?? "none")
  await expect(page.getByTestId("credit-liq-price")).toHaveText(json.liquidation.liquidationPriceUsd ?? "none")
  await expect(page.getByTestId("credit-gap")).toHaveText(
    json.liquidation.gapToLiquidationBps === null ? "none" : String(json.liquidation.gapToLiquidationBps),
  )
  await expect(page.getByTestId("credit-ltv")).toHaveText(String(json.session.maxNewBorrowLtvBps))
  await expect(page.getByTestId("credit-source")).toHaveText(json.price.source)
  expect(json.price.source).not.toContain("issuer's indicative quote")
  await expect(page.getByText(`Keeper post under ${duration(liveness)}`)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(`Inside the ${duration(twap)} pool band`)).toBeVisible()
  await expect(page.getByText(`USDG within ${bpsShort(peg)} of peg`)).toBeVisible()
  await expect(page.getByText("Corporate action pause")).toBeVisible()
  await expect(page.getByText("Issuer pause")).toBeVisible()
  await expect(page.getByTestId("credit-json")).toContainText(json.service)
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/agents-response.png" })
  await page.setViewportSize(viewports.narrow)
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/agents-response-390.png" })
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("credit-price")).toBeHidden()

  await page.setViewportSize(viewports.wide)
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/agents.png", fullPage: true })
  await page.setViewportSize(viewports.medium)
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/agents-768.png", fullPage: true })
  await page.setViewportSize(viewports.narrow)
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/agents-390.png", fullPage: true })
})

/**
 * The shared Next server has no CREDIT_SANDBOX_* env and cannot see this anvil.
 * When /api/credit does not return a report, answer with computeCredit on the harness fork —
 * the same function the route uses — so the page still renders this fork's numbers.
 */
async function installCreditBridge(page: import("@playwright/test").Page) {
  await page.route(/\/api\/credit\?/, async (route) => {
    const upstream = await route.fetch()
    const text = await upstream.text()
    let body: { service?: string } | null = null
    try {
      body = JSON.parse(text) as { service?: string }
    } catch {
      body = null
    }
    if (body?.service === "intatto-credit") {
      await route.fulfill({ status: upstream.status(), contentType: "application/json", body: text })
      return
    }
    // The shared dev server cannot reach this test's fork, so answer with the route's own handler, in process,
    // pointed at the fork (the handler's local-fork mode; the fork has no session API, so `session` is dropped).
    const url = new URL(route.request().url())
    url.searchParams.delete("session")
    try {
      const res = await handleCredit(new Request(url.toString()), {
        ...process.env,
        CREDIT_SANDBOX_RPC: h.env.rpcUrl,
        CREDIT_SANDBOX_DEPLOYMENT: JSON.stringify(h.deployment),
      })
      await route.fulfill({ status: res.status, contentType: "application/json", body: await res.text() })
    } catch {
      await route.fulfill({ status: upstream.status(), contentType: "application/json", body: text })
    }
  })
}
