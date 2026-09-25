/**
 * POST /receipt (token) and GET /receipts (public) on the keeper Worker.
 * Header values never arrive here: the credit API sends names only, plus a truncated User-Agent.
 */
import { timingSafeEqual } from "node:crypto"
import { getAddress, isAddress } from "viem"
import { z } from "zod"

export const RECEIPT_KEEP = 5_000
export const UA_PUBLIC_MAX = 80

const wallet = z
  .string()
  .trim()
  .refine((v) => /^0x[0-9a-fA-F]{40}$/.test(v) && isAddress(v, { strict: true }), { message: "wallet" })
  .transform((v) => getAddress(v))

export const receiptInputSchema = z.object({
  at: z.string().datetime(),
  source: z.enum(["okx-ai", "direct"]),
  wallet,
  market: z.enum(["NVDAx", "SPYx"]),
  network: z.enum(["mainnet", "sandbox"]),
  status: z.number().int().min(0).max(599),
  headerNames: z.array(z.string().min(1).max(60)).max(40),
  ua: z.string().max(200),
})

export type ReceiptInput = z.infer<typeof receiptInputSchema>
export type ReceiptSource = ReceiptInput["source"]

export type PublicReceipt = {
  id: number
  at: string
  source: ReceiptSource
  wallet: string
  market: ReceiptInput["market"]
  network: ReceiptInput["network"]
  status: number
  headerNames: string[]
  /** User-Agent, at most 80 characters. */
  ua: string
}

export type ReceiptSummary = { calls: number; total: number; latest: PublicReceipt[] }

export type ReceiptApi = {
  addReceipt(input: ReceiptInput): Promise<void> | void
  receiptSummary(source: ReceiptSource, limit: number): Promise<ReceiptSummary> | ReceiptSummary
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-receipt-token",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  })

/** Equal length and equal bytes, or false. A length mismatch still touches the secret so the early path is not the only one. */
export function tokenMatches(presented: string, secret: string): boolean {
  const a = Buffer.from(presented)
  const b = Buffer.from(secret)
  if (a.length !== b.length) {
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}

const listQuery = z.object({
  source: z.enum(["okx-ai", "direct"]),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/** Receipt routes, or null when the path belongs to the rest of the keeper. */
export async function handleReceiptHttp(request: Request, env: { RECEIPT_TOKEN?: string }, state: ReceiptApi): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== "/receipt" && url.pathname !== "/receipts") return null
  if (url.pathname === "/receipts") {
    if (request.method !== "GET") return json({ error: "method not allowed", code: "method_not_allowed" }, 405)
    const q = listQuery.safeParse({ source: url.searchParams.get("source") ?? undefined, limit: url.searchParams.get("limit") ?? undefined })
    if (!q.success) return json({ error: "source must be okx-ai or direct, and limit an integer from 1 to 100", code: "bad_query" }, 400)
    return json(await state.receiptSummary(q.data.source, q.data.limit))
  }
  if (request.method !== "POST") return json({ error: "method not allowed", code: "method_not_allowed" }, 405)
  const secret = env.RECEIPT_TOKEN ?? ""
  const presented = request.headers.get("x-receipt-token") ?? ""
  if (!secret || !tokenMatches(presented, secret)) return json({ error: "unauthorized", code: "unauthorized" }, 401)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "receipt body must be JSON", code: "bad_receipt" }, 400)
  }
  const parsed = receiptInputSchema.safeParse(body)
  if (!parsed.success) return json({ error: "invalid receipt", code: "bad_receipt" }, 400)
  await state.addReceipt(parsed.data)
  return json({ ok: true }, 201)
}
