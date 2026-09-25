/**
 * Sandbox journey pieces for the Abel scenario specs: the local sandbox service as the fixture, starting a session
 * through the Sandbox screen, chain reads through the session's public RPC, and the session's ledger.
 *
 * The fixture adds a test-only control port for two things a person cannot trigger from the page: the platform
 * stopping an idle session's container (what 30 idle minutes does) and a keeper posting a post-split price that is
 * inconsistent with the new multiplier. Both go through the session service itself, so the ledger records them.
 */
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { createPublicClient, http, type Address, type PublicClient } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { StepArgs } from "./_abel"
import { expect, fixture, journey, lens, storedSandbox, type Fixture, type StoredSandbox } from "./_intatto"

type Page = StepArgs["page"]
type Entry = { kind: string; summary: string; chainTime: number; txHash?: string; detail?: Record<string, unknown> }

/** Main-process side: the local sandbox service plus its control port (Playwright globalSetup). */
export async function startSandboxFixture() {
  const { startLocalSandbox } = await import("../../services/sandbox/src/local.ts")
  const { activateCorporateAction } = await import("../../checks/fork/lib/scenarios.ts")
  const sb = await startLocalSandbox()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = sb.service as any
  const inconsistent = (id: string) =>
    svc.admin(id, "inconsistent post-split price (journey edge case)", async (s: { state: { pendingAction?: { activationAt: number; ratio: number } }; ctx: never; fork: { chainTime(): Promise<number>; ledger: { add(e: object): Promise<void> } } }) => {
      const pending = s.state.pendingAction
      if (!pending) throw new Error("no pending corporate action")
      await s.fork.ledger.add({ kind: "scenario", summary: "journey edge case: after the split activates, the keeper posts the pre-split quote (not divided by the ratio), inconsistent with the new multiplier", chainTime: await s.fork.chainTime() })
      const r = await activateCorporateAction(s.ctx, pending.activationAt, BigInt(pending.ratio), false)
      await s.fork.ledger.add({ kind: "scenario", summary: `inconsistent post-split price ${r.accepted ? "accepted" : "rejected by the relay"}; the corporate-action guard ${r.paused ? "is still paused" : "resolved"}`, detail: r, chainTime: await s.fork.chainTime() })
    })
  const ctl = createServer((req, res) => {
    const m = req.url?.match(/^\/(expire|inconsistent-activation)\/([\w-]+)$/)
    if (req.method !== "POST" || !m) return void res.writeHead(404).end()
    const work = m[1] === "expire" ? svc.containerStopped(m[2], "idle for more than 30 minutes") : inconsistent(m[2]!)
    Promise.resolve(work).then(
      (r) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(r ?? {}, (_, v) => (typeof v === "bigint" ? v.toString() : v))),
      (e: Error) => res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: e.message })),
    )
  })
  await new Promise<void>((ok) => ctl.listen(0, "127.0.0.1", ok))
  const f: Fixture = {
    kind: "sandbox",
    apiUrl: sb.url,
    controlUrl: `http://127.0.0.1:${(ctl.address() as AddressInfo).port}`,
    forkBlock: sb.meta.forkBlock,
    chainId: sb.meta.chainId,
    deployment: sb.meta.deployment,
  }
  return { fixture: f, stop: async () => { await new Promise<void>((ok) => ctl.close(() => ok())); await sb.stop() } }
}

export async function control(action: "expire" | "inconsistent-activation", sessionId: string) {
  const res = await fetch(`${fixture("sandbox").controlUrl}/${action}/${sessionId}`, { method: "POST" })
  const body = await res.json()
  if (!res.ok) throw new Error(`control ${action} failed: ${JSON.stringify(body)}`)
  return body as { entries?: Entry[] }
}

export async function ledgerOf(sessionId: string): Promise<Entry[]> {
  return ((await (await fetch(`${fixture("sandbox").apiUrl}/session/${sessionId}/ledger`)).json()) as { entries: Entry[] }).entries
}

/** The stored session's chain through its public RPC, the deployment it carries and the burner. */
export async function sessionChain(s: StoredSandbox = journey.session as StoredSandbox) {
  const client = createPublicClient({ transport: http(s.rpcUrl, { timeout: 120_000 }) }) as PublicClient
  const burner = privateKeyToAccount(s.burnerKey).address
  const d = s.deployment
  const nvda = d.markets.find((m) => m.symbol === "NVDAx")!
  return { client, burner, d, nvda, s, L: await lens(client as never, d, burner) }
}

/** Sandbox screen → "Start a session": returns the API's answer and the session the app stored. */
export async function startSessionOnScreen(page: Page) {
  const f = fixture("sandbox")
  await page.goto(`/sandbox?api=${encodeURIComponent(f.apiUrl)}`)
  await expect(page.getByTestId("identity-fork-block")).toContainText(f.forkBlock.toLocaleString("en-US"), { timeout: 120_000 })
  const response = page.waitForResponse((r) => r.url() === `${f.apiUrl}/session` && r.request().method() === "POST", { timeout: 180_000 })
  await page.getByRole("button", { name: "Start a session" }).click()
  const res = await response
  const created = (await res.json()) as { sessionId: string; rpcUrl: string; burnerAddress: Address; entries: Entry[] }
  await expect(page.getByTestId("sandbox-session")).toBeVisible({ timeout: 120_000 })
  const stored = (await storedSandbox(page))!
  expect(stored.sessionId).toBe(created.sessionId)
  journey.session = stored
  return { status: res.status(), created, stored }
}

/** Main navigation (desktop width). */
export async function go(page: Page, label: "Market" | "Borrow" | "Lend" | "Risk" | "Sandbox" | "Agents" | "Fork proof") {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: label, exact: true }).click()
}

/** Chain time on the banner and the RPC's latest block agree; returns that time. */
export async function bannerTimeMatchesRpc(page: Page, client: PublicClient) {
  let t = 0
  await expect(async () => {
    const block = await client.getBlock({ blockTag: "latest" })
    t = Number(block.timestamp)
    await expect(page.locator('[data-slot="sandbox-banner"] time')).toHaveAttribute("datetime", new Date(t * 1000).toISOString(), { timeout: 1_000 })
  }).toPass({ timeout: 60_000 })
  return t
}

/** Presses a sandbox admin control and waits for its result; returns the API's answer. */
export async function adminAction(page: Page, button: string, path: "warp" | "scenario", timeout = 300_000) {
  const s = journey.session as StoredSandbox
  const response = page.waitForResponse((r) => r.url().endsWith(`/session/${s.sessionId}/${path}`) && r.request().method() === "POST", { timeout })
  await page.getByRole("button", { name: button }).click()
  const res = await response
  const body = (await res.json()) as { entries: Entry[]; chain?: { chainTime: number; session: string } }
  await expect(page.getByTestId("action-result")).toContainText(`${button}: done`, { timeout: 120_000 })
  return { status: res.status(), body }
}

/** The ledger on the screen equals GET /session/:id/ledger (count, kinds, summaries; newest first on screen). */
export async function ledgerMatchesApi(page: Page) {
  const s = journey.session as StoredSandbox
  let entries: Entry[] = []
  await expect(async () => {
    entries = await ledgerOf(s.sessionId)
    await expect(page.getByTestId("ledger-row")).toHaveCount(entries.length, { timeout: 1_000 })
    const shown = await page.getByTestId("ledger-summary").allTextContents()
    expect(shown).toEqual(entries.map((e) => e.summary).reverse())
  }).toPass({ timeout: 60_000 })
  return entries
}
