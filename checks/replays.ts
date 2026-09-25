/**
 * Replay provenance. Recomputes every sha256 and checks labels, anchors and bar order.
 * Run: npx tsx checks/replays.ts
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "replays")
const sec = (iso: string) => Date.parse(iso) / 1000
const FRIDAY_OPEN_T = sec("2025-01-24T14:30:00Z")
const FRIDAY_CLOSE_T = sec("2025-01-24T20:59:00Z")
const MONDAY_OPEN_T = sec("2025-01-27T14:30:00Z")
const MONDAY_CLOSE_T = sec("2025-01-27T20:59:00Z")
const FRIDAY_CLOSE = 142.596
const MONDAY_OPEN = 124.817
const YAHOO =
  "https://query1.finance.yahoo.com/v8/finance/chart/NVDA?period1=1737676800&period2=1738108800&interval=1d"
const MULTIPLIER_URL = "https://api.xstocks.fi/api/v2/public/assets/NVDAx/multiplier?network=XLayer"
const CURRENT_MULTIPLIER = 1.001701196801074
const SCENARIO_NOTE =
  "A 10-for-1 split applied as a multiplier change; NVDA's real 10-for-1 split took effect 10 June 2024."
const SYNTHETIC_NOTE = "A 45% overnight gap used only to exhaust the gap reserve and show deficit recognition."
const PROVENANCE_AT = "2026-09-25T05:46:50.604362+00:00"

const sha = z.string().regex(/^[0-9a-f]{64}$/)
const sourceSchema = z.object({
  url: z.string().url(),
  retrievedAt: z.string().min(20),
  sha256: sha,
  file: z.string().min(1),
}).strict()
const barSchema = z.object({
  t: z.number().int().positive(),
  o: z.number().positive(),
  h: z.number().positive(),
  l: z.number().positive(),
  c: z.number().positive(),
}).strict()
const gapSchema = z.object({
  id: z.literal("nvda-2025-01-gap"),
  label: z.string(),
  kind: z.literal("cfd-counterfactual"),
  instrument: z.literal("NVDA.US-USD BID (Dukascopy CFD)"),
  sources: z.array(sourceSchema).length(2),
  bars: z.array(barSchema),
  anchors: z.object({
    fridayClose: z.object({ t: z.number().int(), c: z.number() }).strict(),
    mondayOpen: z.object({ t: z.number().int(), o: z.number() }).strict(),
  }).strict(),
  dailyCrossCheck: z.object({
    source: z.string().url(),
    fridayClose: z.number(),
    mondayOpen: z.number(),
    mondayClose: z.number(),
  }).strict(),
  contentSha256: sha,
}).strict()
const actionSchema = z.object({
  id: z.literal("nvda-corporate-action"),
  kind: z.literal("issuer-multiplier"),
  label: z.string(),
  sources: z.array(sourceSchema).length(2),
  currentMultiplier: z.number().positive(),
  scenario: z.object({
    splitRatio: z.number(),
    preMultiplier: z.number(),
    postMultiplier: z.number(),
    note: z.string(),
  }).strict(),
  contentSha256: sha,
}).strict()
const syntheticSchema = z.object({
  id: z.literal("synthetic-gap"),
  kind: z.literal("synthetic"),
  label: z.string(),
  gapBps: z.number(),
  note: z.string(),
  sources: z.array(sourceSchema),
  contentSha256: sha,
}).strict()
const indexSchema = z.array(z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  file: z.string(),
  sha256: sha,
}).strict()).length(3)

type Source = z.infer<typeof sourceSchema>

function ok(message: string) {
  process.stdout.write(`ok ${message}\n`)
}

function fail(message: string): never {
  process.stderr.write(`FAIL ${message}\n`)
  process.exit(1)
}

function assert(cond: boolean, message: string) {
  if (!cond) fail(message)
  ok(message)
}

function readBytes(rel: string): Buffer {
  if (rel.startsWith("/") || rel.split("/").includes("..")) fail(`path escapes replays: ${rel}`)
  try {
    return readFileSync(join(root, rel))
  } catch (error) {
    fail(`cannot read ${rel} (${error instanceof Error ? error.message : "unknown"})`)
  }
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function readJson(rel: string): unknown {
  try {
    return JSON.parse(readBytes(rel).toString("utf8"))
  } catch (error) {
    fail(`${rel} is not readable JSON (${error instanceof Error ? error.message : "unknown"})`)
  }
}

function parse<T>(schema: z.ZodType<T>, data: unknown, name: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")
    fail(`${name} schema: ${detail}`)
  }
  ok(`${name} matches its schema`)
  return result.data
}

function assertSource(name: string, actual: Source, expected?: Partial<Source>) {
  assert(actual.url.length > 0 && actual.retrievedAt.length > 0, `${name} has a source url and retrievedAt`)
  assert(Number.isFinite(Date.parse(actual.retrievedAt)), `${name} retrievedAt is ISO time`)
  if (expected?.url) assert(actual.url === expected.url, `${name} url is the recorded source`)
  if (expected?.retrievedAt) assert(actual.retrievedAt === expected.retrievedAt, `${name} retrievedAt is the provenance time`)
  if (expected?.file) assert(actual.file === expected.file, `${name} file is ${expected.file}`)
  if (expected?.sha256) assert(actual.sha256 === expected.sha256, `${name} records the provenance sha256`)
  assert(sha256(readBytes(actual.file)) === actual.sha256, `${name} sha256 matches ${actual.file} bytes`)
}

const gap = parse(gapSchema, readJson("nvda-2025-01-gap.json"), "nvda-2025-01-gap.json")
const action = parse(actionSchema, readJson("nvda-corporate-action.json"), "nvda-corporate-action.json")
const synthetic = parse(syntheticSchema, readJson("synthetic-gap.json"), "synthetic-gap.json")
const index = parse(indexSchema, readJson("index.json"), "index.json")

assert(gap.label === "CFD counterfactual prices, not historical X Layer liquidity", "CFD label says CFD counterfactual")
assert(gap.bars.length === 780, "CFD replay has 780 bars")

let increasing = true
let ordered = true
const gaps: number[] = []
for (let i = 0; i < gap.bars.length; i++) {
  const bar = gap.bars[i]
  if (i > 0) {
    const step = bar.t - gap.bars[i - 1].t
    if (step <= 0) increasing = false
    if (step !== 60) gaps.push(i)
  }
  if (!(bar.l <= Math.min(bar.o, bar.c) && Math.max(bar.o, bar.c) <= bar.h)) ordered = false
}
assert(increasing, "CFD bar timestamps are strictly increasing")
assert(gaps.length === 1 && gap.bars[gaps[0]].t === MONDAY_OPEN_T, "the only gap is the weekend; no minute was filled or interpolated")
assert(ordered, "each CFD bar keeps low <= open/close <= high")
assert(
  gap.bars[0].t === FRIDAY_OPEN_T && gap.bars[389].t === FRIDAY_CLOSE_T && gap.bars[390].t === MONDAY_OPEN_T && gap.bars[779].t === MONDAY_CLOSE_T,
  "bars cover Friday 14:30–20:59 UTC and Monday 14:30–20:59 UTC",
)

const friday = gap.bars.find((bar) => bar.t === FRIDAY_CLOSE_T)
const monday = gap.bars.find((bar) => bar.t === MONDAY_OPEN_T)
assert(friday?.c === FRIDAY_CLOSE, "Friday 20:59 UTC close is 142.596")
assert(monday?.o === MONDAY_OPEN, "Monday 14:30 UTC open is 124.817")
assert(gap.anchors.fridayClose.t === FRIDAY_CLOSE_T && gap.anchors.fridayClose.c === FRIDAY_CLOSE, "fridayClose anchor is 142.596 at 20:59 UTC")
assert(gap.anchors.mondayOpen.t === MONDAY_OPEN_T && gap.anchors.mondayOpen.o === MONDAY_OPEN, "mondayOpen anchor is 124.817 at 14:30 UTC")
assert(
  friday?.o === 142.527 && friday.h === 142.737 && friday.l === 142.466 && monday?.h === 124.906 && monday.l === 123.616 && monday.c === 123.706,
  "anchor minutes match the decoded Dukascopy bid bars",
)
assert(sha256(JSON.stringify(gap.bars)) === gap.contentSha256, "gap contentSha256 matches JSON.stringify(bars)")
assert(gap.dailyCrossCheck.source === YAHOO, "daily cross-check cites the Yahoo NVDA chart")
assert(gap.dailyCrossCheck.fridayClose === 142.62, "Yahoo Friday close cross-check is 142.62")
assert(gap.dailyCrossCheck.mondayOpen === 124.8, "Yahoo Monday open cross-check is 124.80")
assert(gap.dailyCrossCheck.mondayClose === 118.42, "Yahoo Monday close cross-check is 118.42")

assertSource("24 Jan CFD", gap.sources[0], {
  url: "https://jetta.dukascopy.com/v1/candles/minute/NVDA.US-USD/BID/2025/1/24",
  retrievedAt: PROVENANCE_AT,
  sha256: "e2ca743f234eb999934e78787e99abc6c4d4083fed8ee0d2df64c12917b1356f",
  file: "raw/nvda-2025-01-24-minute.raw",
})
assertSource("27 Jan CFD", gap.sources[1], {
  url: "https://jetta.dukascopy.com/v1/candles/minute/NVDA.US-USD/BID/2025/1/27",
  retrievedAt: PROVENANCE_AT,
  sha256: "260e214fc90fd217f711c6862482282decca6c9e820c2f0e4f37550663f2a6ec",
  file: "raw/nvda-2025-01-27-minute.raw",
})

assert(
  action.label === "Issuer multiplier history (current multiplier from the public API); the activation replayed in the sandbox is a scenario",
  "corporate-action label records the issuer multiplier and a scenario activation",
)
assert(action.currentMultiplier === CURRENT_MULTIPLIER, "current multiplier is 1.001701196801074")
assert(action.scenario.splitRatio === 10, "scenario split ratio is 10")
assert(action.scenario.preMultiplier === CURRENT_MULTIPLIER, "scenario preMultiplier is the current multiplier")
assert(action.scenario.postMultiplier === 10.01701196801074, "scenario postMultiplier is the 10-for-1 multiple")
assert(action.scenario.note === SCENARIO_NOTE, "scenario note records the real 10 June 2024 split")
assert(sha256(JSON.stringify(action.scenario)) === action.contentSha256, "corporate-action contentSha256 matches JSON.stringify(scenario)")
assertSource("saved multiplier", action.sources[0], {
  url: MULTIPLIER_URL,
  retrievedAt: "2026-09-25T05:36:15.497129+00:00",
  sha256: "dcbeae97cb0d53e05e2aeede080fd458ebd16d06d2d1700fbf6cce4986a326ce",
  file: "raw/nvda-multiplier.json",
})
assertSource("live multiplier", action.sources[1], {
  url: MULTIPLIER_URL,
  file: "raw/nvda-multiplier-2026-09-25.json",
})

const savedMultiplier = parse(
  z.object({
    retrievedAt: z.literal("2026-09-25T05:36:15.497129+00:00"),
    source: z.literal(MULTIPLIER_URL),
    response: z.object({ currentMultiplier: z.literal(CURRENT_MULTIPLIER) }).passthrough(),
  }).passthrough(),
  readJson("raw/nvda-multiplier.json"),
  "raw/nvda-multiplier.json",
)
assert(savedMultiplier.response.currentMultiplier === action.currentMultiplier, "saved multiplier file is the issuer response the scenario uses")
const liveMultiplier = parse(
  z.object({
    currentMultiplier: z.number(),
    newMultiplier: z.number(),
    activationDateTime: z.number(),
    reason: z.null(),
  }).strict(),
  readJson("raw/nvda-multiplier-2026-09-25.json"),
  "raw/nvda-multiplier-2026-09-25.json",
)
assert(liveMultiplier.currentMultiplier === CURRENT_MULTIPLIER, "live multiplier response on 2026-09-25 matches the recorded current multiplier")

assert(synthetic.kind === "synthetic", "synthetic replay kind is synthetic")
assert(synthetic.label.includes("Synthetic"), "synthetic replay label contains Synthetic")
assert(synthetic.label === "Synthetic gap larger than the reserve (not market data)", "synthetic replay label states it is not market data")
assert(synthetic.sources.length === 0, "synthetic replay has no market-data source")
assert(synthetic.gapBps === 4500, "synthetic gap is 4500 bps")
assert(synthetic.note === SYNTHETIC_NOTE, "synthetic note says the gap is only for reserve exhaustion")
assert(
  sha256(JSON.stringify({ gapBps: synthetic.gapBps, note: synthetic.note })) === synthetic.contentSha256,
  "synthetic contentSha256 matches JSON.stringify({gapBps, note})",
)

const expectedIndex = [
  ["nvda-2025-01-gap", "cfd-counterfactual", gap.label, "nvda-2025-01-gap.json"],
  ["nvda-corporate-action", "issuer-multiplier", action.label, "nvda-corporate-action.json"],
  ["synthetic-gap", "synthetic", synthetic.label, "synthetic-gap.json"],
] as const
expectedIndex.forEach(([id, kind, label, file], position) => {
  const entry = index[position]
  assert(entry?.id === id && entry.kind === kind && entry.label === label && entry.file === file, `index lists ${file}`)
  assert(entry !== undefined && sha256(readBytes(file)) === entry.sha256, `index sha256 matches ${file} bytes`)
})
