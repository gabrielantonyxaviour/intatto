/**
 * GET /api/risk/logs?network=mainnet&from=<block>&to=<block> — raw eth_getLogs for every Intatto contract in one
 * ≤100-block chunk, one upstream call per chunk (no batching), cached at the edge: a day for chunks safely in the
 * past (to < latest − 10), 15 s for fresh ones. Errors are `{ error, code }`; nothing upstream is echoed.
 */
import { z } from "zod"
import { deploymentSchema, type Deployment } from "@intatto/config/deployments"
import { XLAYER_CHAIN_ID, xlayerRpcUrls } from "@intatto/config/xlayer"
import committed from "../../../deployments/xlayer-mainnet.json"
import { LOG_CHUNK, watchedAddresses, type RawLog } from "./addresses"

type Env = Record<string, string | undefined>
const HEADERS = { "Access-Control-Allow-Origin": "*" }
const PAST_TTL = 86_400
const FRESH_TTL = 15
const SETTLED = 10n

const query = z
  .object({
    network: z.literal("mainnet"),
    from: z.string().regex(/^\d{1,12}$/),
    to: z.string().regex(/^\d{1,12}$/),
  })
  .transform((q) => ({ network: q.network, from: BigInt(q.from), to: BigInt(q.to) }))
  .refine((q) => q.to >= q.from && q.to - q.from < BigInt(LOG_CHUNK), { message: "range" })

const fail = (status: number, error: string, code: string) => Response.json({ error, code }, { status, headers: { ...HEADERS, "Cache-Control": "no-store" } })

function env(): Env {
  return typeof process !== "undefined" && process.env ? process.env : {}
}

/** LIVE_DEPLOYMENT, then the build-time public value, then the committed mainnet deployment file. */
export function mainnetDeployment(e: Env = env()): Deployment | null {
  const raw = e.LIVE_DEPLOYMENT?.trim() || e.NEXT_PUBLIC_LIVE_DEPLOYMENT?.trim()
  let value: unknown = committed
  if (raw) {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  const parsed = deploymentSchema.safeParse(value)
  return parsed.success && parsed.data.chainId === XLAYER_CHAIN_ID ? parsed.data : null
}

/** One JSON-RPC call, falling through the RPC list on any failure (429s included). */
async function rpc<T>(method: string, params: unknown[], e: Env): Promise<T> {
  for (const url of xlayerRpcUrls(e)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const body = (await res.json()) as { result?: T; error?: unknown }
      if (body.error === undefined && body.result !== undefined) return body.result
    } catch {
      // try the next endpoint
    }
  }
  throw new Error("no RPC answered")
}

let head: { block: bigint; at: number } | null = null
async function latestBlock(e: Env): Promise<bigint> {
  if (head && Date.now() - head.at < 5_000) return head.block
  head = { block: BigInt(await rpc<string>("eth_blockNumber", [], e)), at: Date.now() }
  return head.block
}

type EdgeCache = { match(k: Request): Promise<Response | undefined>; put(k: Request, r: Response): Promise<void> }
function edgeCache(): EdgeCache | null {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches
  return c?.default ?? null
}

export async function handleRiskLogs(req: Request, e: Env = env()): Promise<Response> {
  const url = new URL(req.url)
  const parsed = query.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return fail(400, `Pass network=mainnet and a block range of at most ${LOG_CHUNK} blocks (from ≤ to).`, "INVALID_RANGE")
  const d = mainnetDeployment(e)
  if (!d) return fail(503, "Intatto is not deployed on mainnet yet.", "NOT_DEPLOYED")
  const { from, to } = parsed.data
  if (to < BigInt(d.block)) return fail(400, `The deployment starts at block ${d.block}.`, "BEFORE_DEPLOYMENT")

  const cache = edgeCache()
  const key = new Request(url.toString(), { method: "GET" })
  const hit = await cache?.match(key).catch(() => undefined)
  if (hit) return hit
  try {
    const latest = await latestBlock(e)
    if (from > latest) return fail(400, `Block ${from} is not mined yet (latest ${latest}).`, "FUTURE_RANGE")
    const upTo = to > latest ? latest : to
    const logs = await rpc<RawLog[]>("eth_getLogs", [{ address: watchedAddresses(d), fromBlock: `0x${from.toString(16)}`, toBlock: `0x${upTo.toString(16)}` }], e)
    const ttl = upTo === to && to + SETTLED < latest ? PAST_TTL : FRESH_TTL
    const res = Response.json(
      { from: from.toString(), to: upTo.toString(), latest: latest.toString(), logs },
      { headers: { ...HEADERS, "Cache-Control": `public, max-age=${ttl}` } },
    )
    if (cache) await cache.put(key, res.clone()).catch(() => undefined)
    return res
  } catch {
    return fail(503, "X Layer did not answer. Try again in a moment.", "CHAIN_UNAVAILABLE")
  }
}
