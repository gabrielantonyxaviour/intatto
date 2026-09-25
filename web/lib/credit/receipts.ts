/**
 * Records a credit API call on the keeper (POST /receipt) and serves GET /api/credit/receipts.
 * A receipt never breaks or meaningfully delays the API: posting times out at 1.5s and every error is swallowed.
 * Only header names are sent, plus the User-Agent in its own field.
 */
import { getAddress, isAddress } from "viem"
import { z } from "zod"
import { errorResponse, json, processEnv, type Env } from "./http"

const OKX_PREFIXES = ["x-okx", "ok-access", "x-a2mcp", "x-agent"]
const POST_TIMEOUT_MS = 1_500

const wallet = z
  .string()
  .trim()
  .refine((v) => /^0x[0-9a-fA-F]{40}$/.test(v) && isAddress(v, { strict: true }), { message: "wallet" })
  .transform((v) => getAddress(v))

const callSchema = z.object({
  wallet,
  market: z.enum(["NVDAx", "SPYx"]),
  network: z.enum(["mainnet", "sandbox"]).default("mainnet"),
})

export type ReceiptCall = z.infer<typeof callSchema>

/** "okx-ai" when an OKX / A2MCP header or user-agent is present, otherwise "direct". */
export function receiptSource(req: Request): "okx-ai" | "direct" {
  for (const name of req.headers.keys()) {
    const n = name.toLowerCase()
    if (OKX_PREFIXES.some((prefix) => n.startsWith(prefix))) return "okx-ai"
  }
  if (/okx|onchainos|a2mcp/i.test(req.headers.get("user-agent") ?? "")) return "okx-ai"
  return "direct"
}

/** Header names only, lowercased, capped so a noisy client cannot inflate the row. */
export function headerNamesOf(req: Request): string[] {
  const names: string[] = []
  req.headers.forEach((_value, name) => {
    if (names.length < 40) names.push(name.toLowerCase().slice(0, 60))
  })
  return names
}

function callOf(req: Request, outcome: ReceiptCall | number): { call: ReceiptCall; status: number } | null {
  if (typeof outcome === "number") {
    let params: URLSearchParams
    try {
      params = new URL(req.url).searchParams
    } catch {
      return null
    }
    const parsed = callSchema.safeParse({
      wallet: params.get("wallet") ?? undefined,
      market: params.get("market") ?? undefined,
      network: params.get("network") ?? undefined,
    })
    return parsed.success ? { call: parsed.data, status: outcome } : null
  }
  const parsed = callSchema.safeParse(outcome)
  return parsed.success ? { call: parsed.data, status: 200 } : null
}

/** Posts one receipt when both RECEIPT_URL and RECEIPT_TOKEN are set. Never throws. */
export async function recordReceipt(req: Request, outcome: ReceiptCall | number, env: Env): Promise<void> {
  try {
    const base = env.RECEIPT_URL?.trim()
    const token = env.RECEIPT_TOKEN
    if (!base || !token) return
    const ready = callOf(req, outcome)
    if (!ready) return
    const body = {
      at: new Date().toISOString(),
      source: receiptSource(req),
      wallet: ready.call.wallet,
      market: ready.call.market,
      network: ready.call.network,
      status: ready.status,
      headerNames: headerNamesOf(req),
      ua: (req.headers.get("user-agent") ?? "").slice(0, 200),
    }
    await defer(postReceipt(`${base.replace(/\/+$/, "")}/receipt`, token, body))
  } catch {
    // A receipt must not change the API response.
  }
}

async function postReceipt(url: string, token: string, body: unknown): Promise<void> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), POST_TIMEOUT_MS)
  try {
    await fetch(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "x-receipt-token": token },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
  } catch {
    // Timeout, refusal, or a down keeper.
  } finally {
    clearTimeout(timer)
  }
}

/** waitUntil on the Cloudflare request context; otherwise the caller awaits the 1.5s post. */
async function defer(work: Promise<void>): Promise<void> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const { ctx } = getCloudflareContext()
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(work)
      return
    }
  } catch {
    // Plain Node (the checks) has no request context.
  }
  await work
}

/** Public proxy of the keeper's GET /receipts. No token and no request headers are forwarded. */
export async function handleReceipts(req: Request, env: Env = processEnv()): Promise<Response> {
  const base = env.RECEIPT_URL?.trim()
  if (!base) return errorResponse(503, "Credit call receipts are not configured.", "RECEIPTS_UNAVAILABLE")
  let incoming: URL
  try {
    incoming = new URL(req.url)
  } catch {
    return errorResponse(503, "Credit call receipts are unavailable.", "RECEIPTS_UNAVAILABLE")
  }
  const target = new URL("/receipts", base.endsWith("/") ? base : `${base}/`)
  const source = incoming.searchParams.get("source")
  const limit = incoming.searchParams.get("limit")
  if (source) target.searchParams.set("source", source)
  if (limit) target.searchParams.set("limit", limit)
  try {
    const res = await fetch(target, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(4_000) })
    if (!res.ok) return errorResponse(503, "Credit call receipts are unavailable.", "RECEIPTS_UNAVAILABLE")
    return json(await res.json())
  } catch {
    return errorResponse(503, "Credit call receipts are unavailable.", "RECEIPTS_UNAVAILABLE")
  }
}
