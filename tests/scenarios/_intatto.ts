/**
 * Intatto helpers for the Abel scenario specs (tests/scenarios/sc_*.spec.ts).
 *
 * How the specs run: under Abel's own Playwright (./_abel re-exports the harness from the Abel checkout, and that
 * harness resolves @playwright/test there, so the runner must be that same copy), headless, video on, with Abel's
 * scenario reporter, and a globalSetup that calls `scenarioGlobalSetup`. The fixture — a local fork with Intatto
 * deployed (`fork`), the local sandbox service (`sandbox`), or the live app (`live`) — is started before the role's
 * test, so the role's recording covers exactly its journey.
 *
 * Env: INTATTO_FIXTURE fork|sandbox|live · INTATTO_SCENARIO_ENV the fixture JSON path · INTATTO_OBS observations
 * (JSONL: what each check and edge case actually read, merged into the finish report by the runner).
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import type { StepArgs } from "./_abel"
import { formatUnits, type Address, type Hex } from "viem"
import type { Deployment } from "@intatto/config/deployments"
import { formatTokenAmount } from "../../web/components/ui/web3/format.ts"
import { ForkChain, Ledger } from "../../checks/fork/lib/chain.ts"
import { context, type ScenarioContext } from "../../checks/fork/lib/scenarios.ts"
import { expect } from "./_abel"

/** The page the Abel harness hands each step (its own Playwright copy). */
type Page = StepArgs["page"]

export { expect }

export type Fixture =
  | { kind: "fork"; rpcUrl: string; chainId: number; forkBlock: number; deployment: Deployment; burnerKey: Hex; burnerAddress: Address }
  | { kind: "sandbox"; apiUrl: string; controlUrl: string; forkBlock: number; chainId: number; deployment: Deployment }
  | { kind: "live" }

/** Starts the fixture named by INTATTO_FIXTURE and returns its teardown (Playwright globalSetup contract). */
export async function scenarioGlobalSetup(): Promise<() => Promise<void>> {
  const kind = process.env.INTATTO_FIXTURE ?? "live"
  const out = process.env.INTATTO_SCENARIO_ENV
  if (!out) throw new Error("INTATTO_SCENARIO_ENV is not set")
  if (kind === "fork") {
    const { startForkHarness } = await import("../../checks/fork/harness.ts")
    const h = await startForkHarness()
    const f: Fixture = { kind, rpcUrl: h.env.rpcUrl, chainId: h.env.chainId, forkBlock: h.env.forkBlock, deployment: h.deployment, burnerKey: h.env.burnerKey, burnerAddress: h.env.burnerAddress }
    writeFileSync(out, JSON.stringify(f))
    return () => h.stop()
  }
  if (kind === "sandbox") {
    const { startSandboxFixture } = await import("./_intatto_sandbox.ts")
    const { fixture: f, stop } = await startSandboxFixture()
    writeFileSync(out, JSON.stringify(f))
    return stop
  }
  writeFileSync(out, JSON.stringify({ kind: "live" }))
  return async () => {}
}

let cached: Fixture | null = null
export function fixtureKind(): Fixture["kind"] {
  cached ??= JSON.parse(readFileSync(process.env.INTATTO_SCENARIO_ENV!, "utf8")) as Fixture
  return cached.kind
}
export function fixture<K extends Fixture["kind"]>(kind: K): Extract<Fixture, { kind: K }> {
  cached ??= JSON.parse(readFileSync(process.env.INTATTO_SCENARIO_ENV!, "utf8")) as Fixture
  if (cached.kind !== kind) throw new Error(`this scenario needs the ${kind} fixture, not ${cached.kind}`)
  return cached as Extract<Fixture, { kind: K }>
}

/** Direct fork access (anvil at the fork fixture's RPC): contract reads, the keeper's posts, clock moves. */
let forkCache: { fork: ForkChain; ctx: ScenarioContext } | null = null
export function forkAccess() {
  const f = fixture("fork")
  if (!forkCache) {
    const fork = new ForkChain(f.rpcUrl, f.chainId, new Ledger())
    forkCache = { fork, ctx: context(fork, f.deployment) }
  }
  return { ...forkCache, f, d: f.deployment, nvda: f.deployment.markets.find((m) => m.symbol === "NVDAx")! }
}

/** Values one step hands to the next inside a role's journey. */
export const journey: Record<string, unknown> = {}

export type LensAccount = { shares: bigint; assets: bigint; valueUsdg: bigint; debt: bigint; ltvBps: bigint; maxLtvBps: bigint; borrowCapacity: bigint; healthFactorE18: bigint; liquidationPriceE18: bigint; walletToken: bigint; walletUsdg: bigint }
export type LensMarket = { session: number; periodChangedAt: bigint; maxLtvBps: bigint; priceE18: bigint; fetchedAt: bigint; fresh: boolean; inBand: boolean; pegOk: boolean; corporateActionPaused: boolean; capUsdg: bigint; sliceUsdg: bigint; totalDebt: bigint; assetsPerShare: bigint; liquidationThresholdBps: bigint }
export type LensVault = { idle: bigint; totalAssets: bigint; totalSupply: bigint; sharePrice: bigint; utilizationBps: bigint; borrowRateBps: bigint; supplyRateBps: bigint; reserveBalance: bigint; totalDeficit: bigint; deficitCount: bigint }

/** MarketLens reads (the same contract the screens read) against any public client. */
export async function lens(client: { readContract: (a: never) => Promise<unknown> }, d: Deployment, who?: Address) {
  const { marketLensAbi } = await import("@intatto/config/abi")
  const market = d.markets.find((m) => m.symbol === "NVDAx")!.market as Address
  const call = (functionName: string, args: unknown[]) => client.readContract({ address: d.lens as Address, abi: marketLensAbi, functionName, args } as never)
  return {
    market: () => call("market", [market]) as Promise<LensMarket>,
    account: (a: Address = who!) => call("account", [market, a]) as Promise<LensAccount>,
    vault: () => call("vault", [market]) as Promise<LensVault>,
  }
}

export type StoredSandbox ={ sessionId: string; apiUrl: string; rpcUrl: string; chainId: number; forkBlock: number; deployment: Deployment; burnerKey: Hex }

/** Seeds the app's sandbox session (localStorage "intatto:sandbox") once per tab, before the first navigation. */
export async function seedSandbox(page: Page, s: StoredSandbox) {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        const marker = `${key}:seeded`
        if (window.sessionStorage.getItem(marker) === value) return
        window.localStorage.setItem(key, value)
        window.sessionStorage.setItem(marker, value)
      } catch {
        // opaque origins have no storage
      }
    },
    { key: "intatto:sandbox", value: JSON.stringify(s) },
  )
}

/** The sandbox session the app stored after "Start a session". */
export function storedSandbox(page: Page) {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem("intatto:sandbox") ?? "null")) as Promise<StoredSandbox | null>
}

type Observation = { kind: "check" | "edge" | "call"; id: string; status: "pass" | "fail"; actual: string; at: number; tx?: string }

function write(o: Observation) {
  const path = process.env.INTATTO_OBS
  if (path) appendFileSync(path, `${JSON.stringify(o)}\n`)
}

/** What a mapped check actually read, in words and numbers (the runner puts it in the check's `actual`). */
export function observe(id: string, actual: string) {
  write({ kind: "check", id, status: "pass", actual, at: Date.now() })
}

/** What a mapped integration actually did (the runner puts it on that integration's event), with its tx if any. */
export function observeCall(integrationId: string, actual: string, tx?: string) {
  write({ kind: "call", id: integrationId, status: "pass", actual, at: Date.now(), ...(tx ? { tx } : {}) })
}

/**
 * Runs an edge case inside a step and records its real outcome. A failing edge case is recorded as failed and does
 * not stop the journey (the role still cannot become ready: Abel requires every required edge case to pass).
 */
export async function edge(id: string, run: () => Promise<string>) {
  try {
    write({ kind: "edge", id, status: "pass", actual: await run(), at: Date.now() })
  } catch (e) {
    write({ kind: "edge", id, status: "fail", actual: `Failed: ${(e as Error).message.replace(/\x1b\[[0-9;]*m/g, "").split("\n").slice(0, 8).join(" ")}`, at: Date.now() })
  }
}

// ── Formatting exactly as the screens do (truncated, grouped) ──
export const usdg = (x: bigint) => `${formatTokenAmount(x, 6, { maxFractionDigits: 2, minFractionDigits: 2 })} USDG`
export const usd = (e18: bigint) => `$${formatTokenAmount(e18, 18, { maxFractionDigits: 2, minFractionDigits: 2 })}`
export const nvdax = (x: bigint) => `${formatTokenAmount(x, 18, { maxFractionDigits: 4 })} NVDAx`
export const wnvdax = (x: bigint) => `${formatTokenAmount(x, 18, { maxFractionDigits: 4 })} wNVDAx`
export const pct = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`
export const health = (e18: bigint) => formatTokenAmount(e18, 18, { maxFractionDigits: 2, minFractionDigits: 2 })
export const utc = (t: bigint | number) => `${new Date(Number(t) * 1000).toISOString().slice(0, 19).replace("T", " ")} UTC`
export const plain = (x: bigint, decimals: number) => formatUnits(x, decimals)

/** Full-hash title of the newest explorer link inside `scope` (on a fork the link renders the hash as text). */
export async function txHashIn(page: Page, scope: string): Promise<Hex> {
  const link = page.locator(`${scope} [data-slot="explorer-link"]`).last()
  await expect(link).toBeVisible({ timeout: 60_000 })
  return (await link.getAttribute("title")) as Hex
}

/** Records every explorer link rendered inside `testId` from now on (some show only while a tx is pending). */
export async function watchTxLinks(page: Page, testId: string) {
  await page.evaluate((id) => {
    const w = window as unknown as { __intattoTx?: string[] }
    w.__intattoTx = []
    const scan = () =>
      document.querySelectorAll(`[data-testid="${id}"] [data-slot="explorer-link"]`).forEach((e) => {
        const t = e.getAttribute("title")
        if (t && !w.__intattoTx!.includes(t)) w.__intattoTx!.push(t)
      })
    new MutationObserver(scan).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  }, testId)
}

export function seenTxLinks(page: Page) {
  return page.evaluate(() => (window as unknown as { __intattoTx?: string[] }).__intattoTx ?? [])
}

/** Polls until what the page shows equals a fresh chain read (both re-read every round). */
export async function shows(what: string, ui: () => Promise<string | null>, chain: () => Promise<string>, timeout = 60_000) {
  let last = ""
  await expect
    .poll(
      async () => {
        const [u, c] = [(await ui())?.trim() ?? null, await chain()]
        last = u ?? ""
        return u === c ? "match" : `page "${u}" vs chain "${c}"`
      },
      { message: what, timeout, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe("match")
  return last
}
