/**
 * Sandbox screen (pg_sandbox), end to end against the LOCAL sandbox service (services/sandbox/src/local.ts: the
 * Worker's router and session service, one anvil per session loaded from the snapshot). Through the UI: start a
 * session → the burner's balances equal RPC reads → Jump to Saturday → the banner's chain time equals the latest
 * block and the session reads CLOSED like SessionRiskController.currentSession() → schedule the split → the ledger
 * rows equal GET /session/:id/ledger and include every admin call made → activate the split → the card's NVDAx
 * balance equals the burner's balanceOf → reset → expiry → a new session → end.
 */
import { mkdirSync } from "node:fs"
import type { Page } from "@playwright/test"
import { createPublicClient, erc20Abi, http, type Address, type PublicClient } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sessionRiskControllerAbi } from "@intatto/config/abi"
import { sessionFromIndex } from "@intatto/config/session"
import { TICKERS } from "@intatto/config/xlayer"
import { test, expect, viewports, expectNoHorizontalScroll } from "./fixtures"
import { startLocalSandbox, type LocalSandbox } from "../../services/sandbox/src/local.ts"
import { formatTokenAmount } from "../../web/components/ui/web3/format.ts"

test.describe.configure({ mode: "serial" })

type Entry = { kind: string; summary: string; chainTime: number }
type Stored = { sessionId: string; apiUrl: string; rpcUrl: string; chainId: number; burnerKey: `0x${string}`; deployment: { usdg: string; sessionRisk: string } }

let sb: LocalSandbox

test.beforeAll(async () => {
  test.setTimeout(300_000)
  sb = await startLocalSandbox()
  mkdirSync("proof", { recursive: true })
})

test.afterAll(async () => {
  await sb?.stop()
})

const stored = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem("intatto:sandbox") ?? "null") as unknown) as Promise<Stored | null>
const ledgerOf = async (id: string) => ((await (await fetch(`${sb.url}/session/${id}/ledger`)).json()) as { entries: Entry[] }).entries

async function currentSession(client: PublicClient, s: Stored) {
  const index = await client.readContract({ address: s.deployment.sessionRisk as Address, abi: sessionRiskControllerAbi, functionName: "currentSession" })
  return sessionFromIndex(Number(index))
}

/** The banner's and the page's chain time both equal the RPC's latest block timestamp. */
async function expectChainTimeMatchesRpc(page: Page, client: PublicClient) {
  await expect(async () => {
    const block = await client.getBlock({ blockTag: "latest" })
    const iso = new Date(Number(block.timestamp) * 1000).toISOString()
    await expect(page.locator('[data-slot="sandbox-banner"] time')).toHaveAttribute("datetime", iso, { timeout: 1_000 })
    await expect(page.getByTestId("chain-time").locator("time")).toHaveAttribute("datetime", iso, { timeout: 1_000 })
  }).toPass({ timeout: 60_000 })
}

/** The full ledger lives in the View ledger sheet. Open it once; a second click would close it. */
async function openLedger(page: Page) {
  const ledger = page.getByTestId("ledger")
  if (!(await ledger.isVisible())) await page.getByRole("button", { name: "View ledger" }).click()
  await expect(ledger).toBeVisible()
}

async function closeDialog(page: Page) {
  const dialog = page.getByRole("dialog")
  if (await dialog.isVisible()) {
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  }
}

/** The ledger shown equals GET /session/:id/ledger: same count, kinds and summaries (newest first on screen). */
async function expectLedgerMatchesApi(page: Page, id: string) {
  await openLedger(page)
  let shown: string[] = []
  await expect(async () => {
    const entries = await ledgerOf(id)
    await expect(page.getByTestId("ledger-row")).toHaveCount(entries.length, { timeout: 1_000 })
    await expect(page.getByTestId("ledger-count")).toHaveText(`${entries.length} entries`, { timeout: 1_000 })
    const kinds = await page.getByTestId("ledger-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-kind")))
    expect(kinds).toEqual(entries.map((e) => e.kind).reverse())
    shown = await page.getByTestId("ledger-summary").allTextContents()
    expect(shown).toEqual(entries.map((e) => e.summary).reverse())
  }).toPass({ timeout: 60_000 })
  return shown
}

/** Top of the page with no toasts, so full-page screenshots show the layout as a person first sees it. */
async function settle(page: Page) {
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 20_000 })
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function screenshotsAtWidths(page: Page, name: string) {
  await settle(page)
  for (const [label, size] of [["390", viewports.narrow], ["768", viewports.medium]] as const) {
    await page.setViewportSize(size)
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: `proof/${name}-${label}.png`, fullPage: true })
  }
  await page.setViewportSize(viewports.wide)
  await expectNoHorizontalScroll(page)
}

test("unavailable: an unreachable sandbox API is said plainly and nothing can start", async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(viewports.narrow)
  await page.goto("/sandbox?api=http://127.0.0.1:9")
  await expect(page.getByTestId("sandbox-unavailable")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole("button", { name: "Start a session" })).toBeDisabled()
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/sandbox-unavailable-390.png", fullPage: true })
})

test("a stored session without an API and with a dead RPC: both said, no blank page", async ({ page, useFork }) => {
  test.setTimeout(180_000)
  const key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const
  await useFork(page, { rpcUrl: "http://127.0.0.1:9", chainId: sb.meta.chainId, forkBlock: sb.meta.forkBlock, deployment: sb.meta.deployment, burnerKey: key, burnerAddress: privateKeyToAccount(key).address })
  await page.goto("/sandbox")
  await expect(page.getByTestId("sandbox-no-api")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId("sandbox-rpc-error")).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId("time-travel")).toHaveCount(0)
})

test("wrong network: an RPC that answers as another chain is flagged", async ({ page, useFork }) => {
  test.setTimeout(180_000)
  const res = await fetch(`${sb.url}/session`, { method: "POST" })
  const created = (await res.json()) as { sessionId: string; rpcUrl: string; burnerKey: `0x${string}` }
  await useFork(page, { rpcUrl: created.rpcUrl, chainId: 196, forkBlock: sb.meta.forkBlock, deployment: sb.meta.deployment, burnerKey: created.burnerKey, burnerAddress: privateKeyToAccount(created.burnerKey).address, sessionApiUrl: sb.url })
  await page.addInitScript((id) => {
    try {
      const v = JSON.parse(window.localStorage.getItem("intatto:sandbox") ?? "null")
      if (v && v.sessionId !== id) window.localStorage.setItem("intatto:sandbox", JSON.stringify({ ...v, sessionId: id }))
    } catch {
      // opaque origins have no storage
    }
  }, created.sessionId)
  await page.goto("/sandbox")
  await expect(page.getByTestId("sandbox-wrong-network")).toContainText("chain 1960196", { timeout: 120_000 })
})

test("start → funded burner → Saturday → split → ledger → reset → expiry → new session → end", async ({ page }) => {
  test.setTimeout(900_000)
  await page.setViewportSize(viewports.wide)
  await page.goto(`/sandbox?api=${encodeURIComponent(sb.url)}`)

  // 1. The fork's identity first, from the service: parent network, chain id, fork block.
  await expect(page.getByTestId("identity-fork-block")).toContainText(sb.meta.forkBlock.toLocaleString("en-US"), { timeout: 120_000 })
  await expect(page.getByTestId("identity-chain-id")).toHaveText(String(sb.meta.chainId))
  await expect(page.getByTestId("seed-snapshot")).toContainText("not organic mainnet activity")
  await expect(page.getByTestId("sandbox-price-source")).toContainText("not the live issuer quote")
  await expect(page.getByRole("button", { name: "Start a session" })).toBeEnabled()
  const details = page.getByRole("button", { name: "Session details" })
  await details.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "Session details" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Session details" })).toBeHidden()
  await expect(details).toBeFocused()
  await page.screenshot({ path: "proof/sandbox-start.png", fullPage: true })
  await screenshotsAtWidths(page, "sandbox-start")

  // 2. Start a session → the session is stored and every screen switches to the fork with the burner.
  const createdResponse = page.waitForResponse((r) => r.url() === `${sb.url}/session` && r.request().method() === "POST", { timeout: 180_000 })
  await page.getByRole("button", { name: "Start a session" }).click()
  const created = (await (await createdResponse).json()) as { sessionId: string; entries: Entry[] }
  await expect(page.getByTestId("sandbox-session")).toBeVisible({ timeout: 120_000 })
  const s = (await stored(page))!
  expect(s.sessionId).toBe(created.sessionId)
  expect(s.apiUrl).toBe(sb.url)
  expect(s.chainId).toBe(1960196)
  const client = createPublicClient({ transport: http(s.rpcUrl) }) as PublicClient
  const burner = privateKeyToAccount(s.burnerKey).address
  await page.getByRole("button", { name: "Session details" }).click()
  await expect(page.getByTestId("identity-rpc")).toContainText(s.rpcUrl)
  await expect(page.getByTestId("sandbox-session").locator(`[title="${burner}"]`).first()).toBeVisible()
  await expect(page.getByTestId("burner-connection")).toContainText("Connected", { timeout: 60_000 })

  // 3. The burner is funded: every balance shown equals the RPC read.
  const token = (sym: "NVDAx" | "SPYx") => TICKERS[sym].token as Address
  const reads = {
    NVDAx: [await client.readContract({ address: token("NVDAx"), abi: erc20Abi, functionName: "balanceOf", args: [burner] }), 18, 4],
    SPYx: [await client.readContract({ address: token("SPYx"), abi: erc20Abi, functionName: "balanceOf", args: [burner] }), 18, 4],
    USDG: [await client.readContract({ address: s.deployment.usdg as Address, abi: erc20Abi, functionName: "balanceOf", args: [burner] }), 6, 2],
    OKB: [await client.getBalance({ address: burner }), 18, 4],
  } as const
  for (const [sym, [value, decimals, digits]] of Object.entries(reads)) {
    expect(value, `${sym} funded`).toBeGreaterThan(0n)
    await expect(page.getByTestId(`balance-${sym}`)).toHaveText(formatTokenAmount(value, decimals, { maxFractionDigits: digits }), { timeout: 60_000 })
  }

  // 4. The public RPC refuses fork control.
  await page.getByRole("button", { name: "Try evm_mine on it" }).click()
  await expect(page.getByTestId("admin-probe")).toContainText("Refused (-32601)")
  await closeDialog(page)
  const howSaturday = page.getByRole("button", { name: "Saturday clock method" })
  await howSaturday.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "Jump to Saturday method" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(howSaturday).toBeFocused()
  const januarySources = page.getByRole("button", { name: "Sources and method: January 2025 NVDA weekend gap" })
  await januarySources.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "January 2025 NVDA weekend gap" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(januarySources).toBeFocused()
  await expect(page.getByTestId("scenario-gap-2025-01")).toContainText("Dukascopy")
  await expect(page.getByTestId("scenario-synthetic-gap")).toContainText("45%")
  const viewLedger = page.getByRole("button", { name: "View ledger" })
  await viewLedger.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "Activity ledger" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(viewLedger).toBeFocused()

  // 5. Jump to Saturday → chain time equals the latest block; the session reads CLOSED like the contract.
  const warpResponse = page.waitForResponse((r) => r.url().endsWith(`/session/${s.sessionId}/warp`), { timeout: 180_000 })
  await page.getByRole("button", { name: "Jump to Saturday", exact: true }).click()
  const warp = (await (await warpResponse).json()) as { entries: Entry[] }
  await expect(page.getByTestId("action-result")).toContainText("Jump to Saturday: done", { timeout: 120_000 })
  await expectChainTimeMatchesRpc(page, client)
  const saturdayTime = Number((await client.getBlock({ blockTag: "latest" })).timestamp)
  expect(new Date(saturdayTime * 1000).getUTCDay()).toBe(6)
  expect(await currentSession(client, s)).toBe("CLOSED")
  await expect(page.getByTestId("market-session")).toHaveText("CLOSED", { timeout: 60_000 })

  // 6. Corporate action (10-for-1 split) → the ledger equals GET /ledger and holds every admin call made.
  const scenarioResponse = page.waitForResponse((r) => r.url().endsWith(`/session/${s.sessionId}/scenario`), { timeout: 300_000 })
  await page.getByRole("button", { name: "Schedule a 10-for-1 split" }).click()
  const scenario = (await (await scenarioResponse).json()) as { entries: Entry[] }
  await expect(page.getByTestId("action-result")).toContainText("Schedule a 10-for-1 split: done", { timeout: 120_000 })
  const shown = await expectLedgerMatchesApi(page, s.sessionId)
  for (const e of [...created.entries, ...warp.entries, ...scenario.entries]) expect(shown, `ledger shows "${e.summary}"`).toContain(e.summary)
  const kinds = new Set(await page.getByTestId("ledger-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-kind"))))
  for (const k of ["deploy", "fund", "keeper", "warp", "scenario", "actor"]) expect(kinds.has(k), `ledger has a ${k} entry`).toBe(true)
  await expect(page.getByTestId("market-session")).toHaveText(await currentSession(client, s), { timeout: 60_000 })
  await closeDialog(page)
  await expectNoHorizontalScroll(page)
  await settle(page)
  await page.screenshot({ path: "proof/sandbox.png", fullPage: true })
  await screenshotsAtWidths(page, "sandbox")

  // 6b. Activate the split. balanceOf rebases when chain time passes activation; the card must show that read.
  const beforeSplit = await client.readContract({ address: token("NVDAx"), abi: erc20Abi, functionName: "balanceOf", args: [burner] })
  const activateResponse = page.waitForResponse((r) => r.url().endsWith(`/session/${s.sessionId}/scenario`) && r.request().method() === "POST", { timeout: 300_000 })
  await page.getByRole("button", { name: "Activate the split" }).click()
  await activateResponse
  await expect(page.getByTestId("action-result")).toContainText("Activate the split: done", { timeout: 180_000 })
  await expect(async () => {
    const onchain = await client.readContract({ address: token("NVDAx"), abi: erc20Abi, functionName: "balanceOf", args: [burner] })
    expect(onchain).toBeGreaterThan(beforeSplit)
    await expect(page.getByTestId("balance-NVDAx")).toHaveText(formatTokenAmount(onchain, 18, { maxFractionDigits: 4 }), { timeout: 2_000 })
  }).toPass({ timeout: 60_000 })

  // 7. Reset → back to the start snapshot: the clock returns, the ledger records the reset.
  await page.getByRole("button", { name: "Reset…" }).click()
  await page.getByRole("button", { name: "Yes, reset" }).click()
  await expect(page.getByTestId("action-result")).toContainText("Reset to the session start: done", { timeout: 120_000 })
  await openLedger(page)
  await expect(page.getByTestId("ledger-row").first()).toHaveAttribute("data-kind", "reset", { timeout: 60_000 })
  await expectChainTimeMatchesRpc(page, client)
  expect(Number((await client.getBlock({ blockTag: "latest" })).timestamp)).toBeLessThan(saturdayTime)
  await expect(page.getByTestId("market-session")).toHaveText(await currentSession(client, s), { timeout: 60_000 })
  await expectLedgerMatchesApi(page, s.sessionId)

  // 8. Expiry (what 30 idle minutes does): the session's chain stops → "Start a new session" gives a fresh one.
  await sb.service.containerStopped(s.sessionId, "idle for more than 30 minutes (check)")
  await page.reload()
  await expect(page.getByTestId("session-expired")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId("session-expired")).toContainText("Session expired")
  await settle(page)
  await page.screenshot({ path: "proof/sandbox-expired.png", fullPage: true })
  await page.getByRole("button", { name: "Start a new session" }).click()
  await expect(async () => {
    const next = await stored(page)
    expect(next?.sessionId).toBeTruthy()
    expect(next?.sessionId).not.toBe(s.sessionId)
  }).toPass({ timeout: 180_000 })
  await expect(page.getByTestId("sandbox-session")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId("time-travel")).toBeVisible({ timeout: 60_000 })

  // 9. End session → back to X Layer mainnet: the stored session is gone and the creation form returns.
  await page.getByRole("button", { name: "End session" }).click()
  await expect(page.getByTestId("start-session")).toBeVisible({ timeout: 60_000 })
  expect(await stored(page)).toBeNull()
  await expect(page.locator('[data-slot="sandbox-banner"]')).toHaveCount(0)
})
