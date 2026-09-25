/**
 * The sandbox HTTP API, shared by the Worker and the local Node server (Request → Response, zod-validated,
 * CORS open, errors as { error, code }). Session work is delegated to a SessionHost.
 */
import { z } from "zod"
import { assemble, forwardable, parseRpcBody } from "./rpc-filter.ts"
import type { SnapshotMeta } from "./snapshot.ts"
import { MAX_WARP_SECONDS } from "./clock.ts"
import { IDLE_MINUTES, SandboxError, SCENARIOS, type SessionHost } from "./types.ts"

const MAX_BODY_BYTES = 512 * 1024
const SESSION_ID = /^[A-Za-z0-9_-]{16,64}$/

const warpBody = z.object({
  target: z.union([
    z.literal("saturday"),
    z.literal("monday"),
    z.object({ seconds: z.number().int().min(60).max(MAX_WARP_SECONDS) }).strict(),
  ]),
})
const scenarioBody = z.object({ name: z.enum(SCENARIOS) })

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
}

/** JSON with BigInts (token amounts) as decimal strings. */
export function json(body: unknown, status = 200): Response {
  const text = JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  return new Response(text, { status, headers: { "content-type": "application/json; charset=utf-8", ...CORS } })
}

const fail = (status: number, code: string, error: string) => json({ error, code }, status)

/** 128 random bits, url-safe. */
export function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function readBody(req: Request): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > MAX_BODY_BYTES) throw new SandboxError(413, "body_too_large", "request body is too large")
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) throw new SandboxError(413, "body_too_large", "request body is too large")
  return text
}

async function parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await readBody(req)
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : {}
  } catch {
    throw new SandboxError(400, "invalid_json", "request body is not valid JSON")
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new SandboxError(400, "invalid_request", `${issue.path.join(".") || "body"}: ${issue.message}`)
  }
  return parsed.data
}

export type RouterDeps = { host: SessionHost; meta: SnapshotMeta; newId?: () => string }

export function createRouter({ host, meta, newId = newSessionId }: RouterDeps) {
  const sessionUrls = (origin: string, id: string) => ({
    apiUrl: origin,
    rpcUrl: `${origin}/rpc/${id}`,
    ledgerUrl: `${origin}/session/${id}/ledger`,
  })
  const common = { chainId: meta.chainId, forkBlock: meta.forkBlock, deployment: meta.deployment }

  async function route(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const origin = url.origin
    const parts = url.pathname.split("/").filter(Boolean)
    const method = req.method.toUpperCase()
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

    if (parts.length === 1 && parts[0] === "health" && method === "GET") {
      return json({ ok: true, service: "intatto-sandbox", ...common, snapshotCreatedAt: meta.createdAt, markets: meta.deployment.markets.map((m) => m.symbol) })
    }

    if (parts[0] === "rpc" && parts.length === 2) {
      if (method !== "POST") return fail(405, "method_not_allowed", "the sandbox RPC accepts POST only")
      const id = sessionId(parts[1])
      const parsed = parseRpcBody(await readBody(req))
      if ("invalid" in parsed) return json(parsed.invalid)
      const responses = await host.rpc(id, forwardable(parsed.slots))
      const out = assemble(parsed.slots, responses)
      return json(parsed.batch ? out : out[0])
    }

    if (parts[0] !== "session") return fail(404, "not_found", "no such route")

    if (parts.length === 1) {
      if (method !== "POST") return fail(405, "method_not_allowed", "use POST /session to start a session")
      const id = newId()
      const created = await host.create(id)
      return json(
        { sessionId: id, ...sessionUrls(origin, id), ...common, burnerKey: created.burnerKey, burnerAddress: created.burnerAddress, status: "active", expiresAfterIdleMinutes: IDLE_MINUTES, entries: created.entries },
        201,
      )
    }

    const id = sessionId(parts[1])
    const action = parts[2]
    if (parts.length === 2 && method === "GET") {
      const info = await host.info(id)
      return json({ ...info, ...sessionUrls(origin, id), ...common, expiresAfterIdleMinutes: IDLE_MINUTES })
    }
    if (parts.length === 3 && action === "ledger" && method === "GET") return json({ sessionId: id, entries: await host.ledger(id) })
    if (parts.length === 3 && method === "POST") {
      if (action === "warp") return json(await host.warp(id, (await parseJson(req, warpBody)).target))
      if (action === "scenario") return json(await host.scenario(id, (await parseJson(req, scenarioBody)).name))
      if (action === "reset") return json(await host.reset(id))
    }
    return fail(404, "not_found", "no such route")
  }

  return async function handle(req: Request): Promise<Response> {
    try {
      return await route(req)
    } catch (e) {
      if (e instanceof SandboxError) return fail(e.status, e.code, e.message)
      return fail(500, "internal", "the sandbox could not complete this request")
    }
  }
}

function sessionId(raw: string): string {
  if (!SESSION_ID.test(raw)) throw new SandboxError(400, "invalid_session_id", "session ids are 16–64 url-safe characters")
  return raw
}
