/**
 * Receipt recording: source detection, the POST the credit API sends, a slow keeper that must not stall
 * the API, and the keeper SQLite store. `npx tsx checks/credit-receipts.ts`
 */
import { createServer, type IncomingMessage, type Server, type Socket } from "node:http"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { getAddress } from "viem"
import { headerNamesOf, handleReceipts, receiptSource, recordReceipt } from "../web/lib/credit/receipts.ts"
import { SqlKeeperStore, type SqlExec } from "../services/keeper/src/store.ts"

function fail(message: string): never {
  process.stderr.write(`not ok ${message}\n`)
  process.exit(1)
}
const ok = (message: string) => process.stdout.write(`ok ${message}\n`)

function nodeSql(): SqlExec {
  const db = new DatabaseSync(":memory:")
  return {
    exec(query, ...bindings) {
      const rows = db.prepare(query).all(...bindings) as Record<string, unknown>[]
      return { toArray: () => rows }
    },
  }
}

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

function track(server: Server) {
  const sockets = new Set<Socket>()
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  return sockets
}

const listen = (server: Server) =>
  new Promise<number>((resolveListen, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address && typeof address === "object") resolveListen(address.port)
      else reject(new Error("no port"))
    })
  })

const close = (server: Server, sockets: Set<Socket>) =>
  new Promise<void>((resolveClose) => {
    for (const socket of sockets) socket.destroy()
    server.close(() => resolveClose())
  })

const WALLET = getAddress("0x0000000000000000000000000000000000000001")
const SECRET = "super-secret-value"
const BEARER = "Bearer hunter2"

function sample(headers: Record<string, string>) {
  return new Request(`https://intatto.larinova.com/api/credit?wallet=${WALLET}&market=NVDAx&network=sandbox`, { headers })
}

function sources() {
  const cases: [Record<string, string>, "okx-ai" | "direct"][] = [
    [{ "x-okx-request-id": SECRET }, "okx-ai"],
    [{ "OK-ACCESS-KEY": SECRET }, "okx-ai"],
    [{ "X-A2MCP-Call": SECRET }, "okx-ai"],
    [{ "x-agent-id": SECRET }, "okx-ai"],
    [{ "user-agent": "OnchainOS/1.0" }, "okx-ai"],
    [{ "user-agent": "some-a2mcp-client" }, "okx-ai"],
    [{ "user-agent": "Mozilla/5.0" }, "direct"],
    [{ "x-request-id": SECRET }, "direct"],
  ]
  for (const [headers, want] of cases) {
    const got = receiptSource(sample(headers))
    if (got !== want) fail(`source for ${Object.keys(headers).join(",")} was ${got}, expected ${want}`)
  }
  ok("source is okx-ai for x-okx, ok-access, x-a2mcp, x-agent and an OKX/A2MCP user-agent; otherwise direct")
}

async function postsBody() {
  const seen: { token: string; raw: string }[] = []
  const server = createServer(async (req, res) => {
    seen.push({ token: String(req.headers["x-receipt-token"] ?? ""), raw: await readBody(req) })
    res.writeHead(201, { "content-type": "application/json" })
    res.end('{"ok":true}')
  })
  const sockets = track(server)
  const port = await listen(server)
  try {
    const req = sample({ "x-okx-request-id": SECRET, authorization: BEARER, "user-agent": "curl/8.0" })
    await recordReceipt(req, 200, { RECEIPT_URL: `http://127.0.0.1:${port}`, RECEIPT_TOKEN: "tok-1" })
    if (seen.length !== 1) fail(`expected one receipt post, saw ${seen.length}`)
    const { token, raw } = seen[0]
    if (token !== "tok-1") fail("receipt post did not send x-receipt-token")
    if (raw.includes(SECRET) || raw.includes(BEARER) || raw.includes("hunter2")) fail("receipt body included a header value")
    const body = JSON.parse(raw) as { source: string; wallet: string; market: string; network: string; status: number; headerNames: string[]; ua: string }
    if (body.source !== "okx-ai" || body.wallet !== WALLET || body.market !== "NVDAx" || body.network !== "sandbox" || body.status !== 200) {
      fail(`receipt body was ${raw}`)
    }
    if (!body.headerNames.includes("x-okx-request-id") || !body.headerNames.includes("authorization")) fail("header names were dropped")
    if (body.headerNames.some((name) => name.includes(SECRET))) fail("a header name contained a value")
    if (body.ua !== "curl/8.0") fail(`ua was ${body.ua}`)
    const names = headerNamesOf(req)
    if (names.some((name) => name === SECRET)) fail("headerNamesOf returned a value")
    ok("recordReceipt posts names, the token and the call, and never a header value")
  } finally {
    await close(server, sockets)
  }
}

async function slowStub() {
  const server = createServer(() => {})
  const sockets = track(server)
  const port = await listen(server)
  const req = sample({ "user-agent": "Mozilla/5.0" })
  const env = { RECEIPT_URL: `http://127.0.0.1:${port}`, RECEIPT_TOKEN: "tok-1" }
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const tooSlow = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("still waiting")), 1_800)
    })
    await Promise.race([recordReceipt(req, 200, env), tooSlow])
    const elapsed = Date.now() - started
    if (elapsed > 1_700) fail(`slow receipt returned in ${elapsed}ms`)
    await recordReceipt(req, 200, { RECEIPT_URL: "http://127.0.0.1:1", RECEIPT_TOKEN: "tok-1" })
    ok(`a hanging or refused receipt does not throw and returned in ${elapsed}ms`)
  } finally {
    if (timer) clearTimeout(timer)
    await close(server, sockets)
  }
}

function storeLayer() {
  const store = new SqlKeeperStore(nodeSql())
  const dir = resolve(import.meta.dirname, "../services/keeper/migrations")
  store.migrate(readFileSync(resolve(dir, "0001_init.sql"), "utf8"))
  store.migrate(readFileSync(resolve(dir, "0002_receipts.sql"), "utf8"))
  const row = (source: "okx-ai" | "direct") => ({
    at: "2026-09-25T12:00:00.000Z",
    source,
    wallet: WALLET,
    market: "NVDAx" as const,
    network: "sandbox" as const,
    status: 200,
    headerNames: ["accept", "user-agent"],
    ua: "a".repeat(100),
  })
  store.addReceipt(row("okx-ai"))
  store.addReceipt(row("okx-ai"))
  store.addReceipt(row("direct"))
  const okx = store.receiptSummary("okx-ai", 10)
  const direct = store.receiptSummary("direct", 10)
  if (okx.calls !== 2 || direct.calls !== 1 || okx.total !== 3 || direct.total !== 3) {
    fail(`counts okx ${okx.calls}/${okx.total} direct ${direct.calls}/${direct.total}`)
  }
  if (okx.latest[0]?.ua.length !== 80) fail(`public ua length ${okx.latest[0]?.ua.length}`)
  if (okx.latest.some((r) => r.ua.length > 80)) fail("ua was not truncated")
  const pruned = new SqlKeeperStore(nodeSql())
  pruned.migrate(readFileSync(resolve(dir, "0002_receipts.sql"), "utf8"))
  pruned.addReceipt(row("okx-ai"), 2)
  pruned.addReceipt(row("okx-ai"), 2)
  pruned.addReceipt(row("direct"), 2)
  if (pruned.receiptSummary("okx-ai", 10).total !== 2) fail("receipt log did not keep only the newest rows")
  ok("sqlite store counts receipts by source, truncates ua to 80, and keeps the newest rows")
}

async function proxyUnset() {
  const res = await handleReceipts(new Request("https://intatto.larinova.com/api/credit/receipts?source=okx-ai"), {})
  const body = (await res.json()) as { code?: string }
  if (res.status !== 503 || body.code !== "RECEIPTS_UNAVAILABLE") fail(`unset receipts answered ${res.status} ${body.code}`)
  ok("GET /api/credit/receipts without RECEIPT_URL is 503 RECEIPTS_UNAVAILABLE")
}

async function proxyBare() {
  type Row = { id: number; at: string; source: "okx-ai" | "direct"; wallet: string; market: string; network: string; status: number; headerNames: string[]; ua: string }
  const all: Row[] = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({
    id,
    at: `2026-09-25T12:00:0${id}.000Z`,
    source: id % 2 === 0 ? "direct" : "okx-ai",
    wallet: WALLET,
    market: "NVDAx",
    network: "sandbox",
    status: 200,
    headerNames: ["accept"],
    ua: "check",
  }))
  const hits: string[] = []
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    hits.push(`${url.pathname}${url.search}`)
    const source = url.searchParams.get("source")
    const limit = Number(url.searchParams.get("limit") ?? "20")
    if (source !== "okx-ai" && source !== "direct") {
      res.writeHead(400, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "source required", code: "bad_query" }))
      return
    }
    const mine = all.filter((r) => r.source === source).sort((a, b) => b.id - a.id)
    const body = { calls: mine.length, total: all.length, latest: mine.slice(0, limit) }
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  })
  const sockets = track(server)
  const port = await listen(server)
  const env = { RECEIPT_URL: `http://127.0.0.1:${port}` }
  const get = (q: string) => handleReceipts(new Request(`https://intatto.larinova.com/api/credit/receipts${q}`), env)
  try {
    const bare = await get("")
    const body = (await bare.json()) as { calls: { "okx-ai": number; direct: number }; total: number; latest: { id: number; source: string }[] }
    if (bare.status !== 200) fail(`bare receipts answered ${bare.status}`)
    if (body.calls["okx-ai"] !== 4 || body.calls.direct !== 4 || body.total !== 8) fail(`bare counts ${JSON.stringify(body.calls)} total ${body.total}`)
    if (body.latest.map((r) => r.id).join(",") !== "8,7,6,5,4,3,2,1") fail(`bare latest ${body.latest.map((r) => r.id).join(",")}`)
    if (hits.some((h) => h === "/receipts" || h.startsWith("/receipts?"))) {
      const bareHit = hits.find((h) => !h.includes("source="))
      if (bareHit) fail(`bare path called the keeper without a source: ${bareHit}`)
    }
    const limited = await get("?limit=5")
    const five = (await limited.json()) as { latest: { id: number }[] }
    if (limited.status !== 200 || five.latest.map((r) => r.id).join(",") !== "8,7,6,5,4") fail(`limit=5 latest ${JSON.stringify(five.latest)}`)
    const one = await get("?source=direct")
    const direct = (await one.json()) as { calls: number; latest: { source: string }[] }
    if (one.status !== 200 || direct.calls !== 4 || direct.latest.some((r) => r.source !== "direct")) fail("source=direct did not stay a single-source summary")
    const before = hits.length
    const badLimit = await get("?limit=0")
    const badSource = await get("?source=nope")
    const zero = (await badLimit.json()) as { code?: string }
    const nope = (await badSource.json()) as { code?: string }
    if (badLimit.status !== 400 || zero.code !== "BAD_QUERY") fail(`limit=0 answered ${badLimit.status} ${zero.code}`)
    if (badSource.status !== 400 || nope.code !== "BAD_QUERY") fail(`bad source answered ${badSource.status} ${nope.code}`)
    if (hits.length !== before) fail("bad params were forwarded to the keeper")
    ok("GET /api/credit/receipts with no source merges both sources and honours limit")
  } finally {
    await close(server, sockets)
  }
  const down = await handleReceipts(new Request("https://intatto.larinova.com/api/credit/receipts"), { RECEIPT_URL: "http://127.0.0.1:1" })
  const downBody = (await down.json()) as { code?: string }
  if (down.status !== 503 || downBody.code !== "RECEIPTS_UNAVAILABLE") fail(`down keeper answered ${down.status} ${downBody.code}`)
  ok("a keeper that is down is 503 RECEIPTS_UNAVAILABLE on the bare path")
}

sources()
await postsBody()
await slowStub()
storeLayer()
await proxyUnset()
await proxyBare()
ok("credit receipts")
