/**
 * Keeper unit tests (Node): issuer parsing over the recorded fixtures in checks/fixtures/issuer, the HTTP
 * adapter's cache and backoff, the depth-cap math and the SQLite store. Run through `npx tsx checks/keeper.ts --unit`.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { parseUnits } from "viem"
import { issuerFixtureSchema, IssuerError, RecordedIssuer, XStocksIssuer, type IssuerFixture } from "../src/issuer.ts"
import { parseIssuer, type IssuerReading } from "../src/issuer-parse.ts"
import { capFromSamples } from "../src/steps/depth.ts"
import { DEFAULT_OPTIONS } from "../src/context.ts"
import { SqlKeeperStore, type SqlExec } from "../src/store.ts"

type Report = { pass: (m: string) => void; fail: (m: string) => never }

export const FIXTURES = resolve(import.meta.dirname, "..", "..", "..", "checks", "fixtures", "issuer")
export const MIGRATION = resolve(import.meta.dirname, "..", "migrations", "0001_init.sql")

export function loadFixture(name: string): IssuerFixture {
  return issuerFixtureSchema.parse(JSON.parse(readFileSync(join(FIXTURES, name), "utf8")))
}

/** node:sqlite behind the Durable Object SqlStorage shape (exec runs at once, like ctx.storage.sql.exec). */
export function nodeSql(): SqlExec {
  const db = new DatabaseSync(":memory:")
  return {
    exec: (q, ...b) => {
      const rows = db.prepare(q).all(...b) as Record<string, unknown>[]
      return { toArray: () => rows }
    },
  }
}

const utc = (iso: string) => Math.floor(Date.parse(iso) / 1000)
const read = (f: IssuerFixture, at = utc(f.recordedAt)): Promise<IssuerReading> => new RecordedIssuer({ [f.symbol]: f.responses }).read(f.symbol, () => at)

export async function runUnit({ pass, fail }: Report) {
  const expect = (ok: boolean, what: string) => (ok ? pass(what) : fail(what))
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json"))
  for (const f of files) {
    const fx = loadFixture(f)
    if (fx.synthetic !== f.includes(".synthetic.")) fail(`${f}: synthetic flag must match the file name`)
  }
  pass(`${files.length} issuer fixtures load; every synthetic one is labelled in its file name`)

  for (const name of ["nvdax-extended.json", "spyx-extended.json"]) {
    const fx = loadFixture(name)
    const r = await read(fx)
    const quote = (fx.responses.priceData as { quote: number }).quote
    expect(
      r.quoteE18 === parseUnits(String(quote), 18) && r.session === "EXTENDED" && !r.halted && r.disagreement === null && !r.pendingAction,
      `${name} (real): quote $${quote} → ${r.quoteE18} (18 dec), period extended → EXTENDED, not halted, no pending action`,
    )
  }
  const ext = await read(loadFixture("nvdax-extended.json"))
  expect(ext.periodChangedAt === utc("2026-09-25T08:00:00Z"), `extended period start from the calendar: 04:00 ET = ${new Date(ext.periodChangedAt * 1000).toISOString()}`)
  expect(ext.currentMultiplierE18 === 1_001701196801074000n && ext.nextChangeAt === utc("2026-09-25T13:30:00Z"), "current multiplier 1.001701196801074 → 1e18 scale; nextChangeAt parsed")

  const closed = await read(loadFixture("nvdax-closed.synthetic.json"))
  expect(
    closed.session === "CLOSED" && closed.openNow === false && closed.disagreement === null && closed.periodChangedAt === utc("2026-09-26T00:00:00Z") && closed.nextChangeAt === utc("2026-09-28T00:00:00Z"),
    "closed market (synthetic): CLOSED since Friday 20:00 ET, reopens Sunday 20:00 ET",
  )

  const halted = await read(loadFixture("nvdax-halted.synthetic.json"))
  expect(
    halted.session === "HALTED" && halted.halted && halted.disagreement === null && halted.periodChangedAt === halted.fetchedAt,
    "halted (synthetic): every halt flag set → HALTED, period start = fetch time (no calendar match)",
  )
  const split = await read(loadFixture("nvdax-halt-disagree.synthetic.json"))
  expect(split.disagreement?.startsWith("halt flags disagree") === true, `contradictory halt flags (synthetic) → not postable: ${split.disagreement}`)

  const pendingFx = loadFixture("nvdax-pending-multiplier.synthetic.json")
  const pending = await read(pendingFx)
  expect(
    pending.pendingAction?.activationAt === 1_791_198_000 && pending.pendingAction.expectedMultiplierE18 === 10_017011968010740000n && pending.pendingAction.reason === "Stock split 10:1",
    "pending multiplier (synthetic): activation 2026-10-05T11:00Z, expected multiplier 10.01701196801074 → 1e18 scale",
  )
  const after = await read(pendingFx, 1_791_198_000 + 60)
  expect(!after.pendingAction, "a multiplier activation already in the past is not a pending action")

  const noQuote = parseIssuer("NVDAx", { ...loadFixture("nvdax-extended.json").responses, priceData: { quote: null } }, ext.fetchedAt)
  expect(noQuote.quoteE18 === null && noQuote.disagreement === "the issuer returned no quote", "null quote → not postable")
  let threw = false
  try {
    parseIssuer("NVDAx", { ...loadFixture("nvdax-extended.json").responses, status: { symbol: "NVDAx" } }, ext.fetchedAt)
  } catch {
    threw = true
  }
  expect(threw, "a status response missing its halt flags is rejected by the schema")

  await adapterTests({ pass, fail })

  // Real X Layer QuoterV2 sells of wNVDAx on 2026-09-25 (0.5 … 200 shares).
  const outs = [113_183361n, 452_714147n, 2263_056293n, 11303_030925n, 45053_021145n]
  const samples = DEFAULT_OPTIONS.depthSizes.map((amountIn, i) => ({ amountIn, out: outs[i] }))
  const cap = capFromSamples(samples, DEFAULT_OPTIONS)
  expect(cap?.cap === 22526_510572n && cap.slice === 11263_255286n, "depth cap from real quotes: 200 shares within 2% → cap 22,526.51 USDG, slice 11,263.26 USDG")
  const thin = capFromSamples(samples.map((s, i) => (i >= 3 ? { ...s, out: (s.out! * 95n) / 100n } : s)), DEFAULT_OPTIONS)
  expect(thin?.amountIn === parseUnits("10", 18), "a pool 5% worse from 50 shares caps at the 10-share sell")

  const store = new SqlKeeperStore(nodeSql(), () => 1_790_330_000_000)
  store.migrate(readFileSync(MIGRATION, "utf8"))
  store.migrate(readFileSync(MIGRATION, "utf8"))
  store.append({ at: "2026-09-25T10:00:00.000Z", market: "NVDAx", kind: "price", detail: "posted $226.0900", txHash: `0x${"ab".repeat(32)}`, data: { fetchedAt: 1 } })
  await store.set("cursor:NVDAx", "71559900")
  const lockA = store.acquireLock(55_000)
  const lockB = store.acquireLock(55_000)
  let rejected = false
  try {
    store.append({ at: "x", market: "NVDAx", kind: "error", detail: "nope" })
  } catch {
    rejected = true
  }
  const [row] = store.recent(10)
  expect(
    row.kind === "price" && row.txHash?.length === 66 && row.data?.fetchedAt === 1 && (await store.get("cursor:NVDAx")) === "71559900" && lockA && !lockB && rejected,
    "SQLite store (the Durable Object schema): idempotent migration, append/recent, state, cycle lease, unknown kinds refused",
  )
}

async function adapterTests({ pass, fail }: Report) {
  const ext = loadFixture("nvdax-extended.json").responses
  let clock = 1_790_330_000_000
  const calls: string[] = []
  const agents = new Set<string>()
  let mode: "ok" | "429" | "503" = "ok"
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    agents.add(new Headers(init?.headers).get("user-agent") ?? "")
    if (mode === "429") return new Response("{}", { status: 429, headers: { "retry-after": "7" } })
    if (mode === "503") return new Response("{}", { status: 503 })
    const body = url.endsWith("/price-data") ? ext.priceData : url.includes("/multiplier") ? ext.multiplier : url.includes("/system/status/") ? ext.status : ext.asset
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
  }) as typeof fetch
  const issuer = new XStocksIssuer({ fetch: fakeFetch, clock: () => clock })
  const now = () => Math.floor(clock / 1000)
  await issuer.read("NVDAx", now)
  clock += 10_000
  await issuer.read("NVDAx", now)
  const ua = [...agents][0] ?? ""
  if (calls.length !== 6 || agents.size !== 1 || !ua.startsWith("Mozilla/5.0")) fail(`cache/UA: ${calls.length} requests, UA ${ua}`)
  pass("adapter: browser User-Agent; asset + multiplier cached 30 s (2 reads within 10 s → 6 requests, not 8)")

  mode = "429"
  clock += 31_000
  const err = await issuer.read("NVDAx", now).catch((e: unknown) => e)
  if (!(err instanceof IssuerError) || err.code !== "rate-limited" || err.retryAt !== now() + 7) fail(`429 did not respect Retry-After: ${String(err)}`)
  const sent = calls.length
  clock += 5_000
  const held = await issuer.read("NVDAx", now).catch((e: unknown) => e)
  if (!(held instanceof IssuerError) || held.code !== "backoff" || calls.length !== sent) fail("adapter called the API inside its Retry-After window")
  mode = "ok"
  clock += 3_000
  await issuer.read("NVDAx", now)
  pass("adapter: 429 Retry-After 7 → no request for 7 s, then reads again")

  mode = "503"
  clock += 31_000
  const e503 = await issuer.read("NVDAx", now).catch((e: unknown) => e)
  if (!(e503 instanceof IssuerError) || e503.code !== "server" || e503.retryAt !== now() + 30) fail(`503 backoff: ${String(e503)}`)
  pass("adapter: 5xx without Retry-After → 30 s exponential backoff")
}
