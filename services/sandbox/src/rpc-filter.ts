/**
 * The public sandbox RPC's method policy. Browsers read the chain and send transactions they signed with the
 * burner (eth_sendRawTransaction); nothing public may control the fork (time, balances, impersonation, snapshots)
 * or ask the node to sign. Portable: zod only.
 */
import { z } from "zod"
import type { RpcCall } from "./types.ts"

const ALLOWED_PREFIXES = ["eth_", "net_", "web3_"]
const REFUSED_PREFIXES = ["anvil_", "evm_", "hardhat_", "debug_", "trace_", "ots_", "txpool_", "admin_", "personal_", "miner_"]
const REFUSED_METHODS = new Set(["eth_sendTransaction"])

export const METHOD_NOT_ALLOWED = { code: -32601, message: "method not allowed on the public sandbox RPC" } as const
export const MAX_BATCH = 100

export function isAllowedMethod(method: string): boolean {
  if (REFUSED_METHODS.has(method) || method.startsWith("eth_sign")) return false
  if (REFUSED_PREFIXES.some((p) => method.startsWith(p))) return false
  return ALLOWED_PREFIXES.some((p) => method.startsWith(p))
}

const callSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().max(128), z.number(), z.null()]).optional(),
  method: z.string().min(1).max(128),
  params: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional(),
})

type RpcError = { code: number; message: string }
export type RpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: RpcError }

/** One slot per incoming request: either a call to forward or the error response it already has. */
export type RpcSlot = { forward: RpcCall } | { reply: RpcResponse }

export type ParsedRpc = { batch: boolean; slots: RpcSlot[] } | { invalid: RpcResponse }

const errorReply = (id: RpcResponse["id"], error: RpcError): RpcResponse => ({ jsonrpc: "2.0", id, error })

function slotFor(raw: unknown): RpcSlot {
  const parsed = callSchema.safeParse(raw)
  const rawId = (raw as { id?: unknown } | null)?.id
  const id = typeof rawId === "string" || typeof rawId === "number" ? rawId : null
  if (!parsed.success) return { reply: errorReply(id, { code: -32600, message: "invalid JSON-RPC request" }) }
  const call = parsed.data
  if (!isAllowedMethod(call.method)) return { reply: errorReply(call.id ?? null, METHOD_NOT_ALLOWED) }
  return { forward: { jsonrpc: "2.0", id: call.id ?? null, method: call.method, params: call.params ?? [] } }
}

/** Parses a request body into forwardable calls and ready-made refusals, preserving order. */
export function parseRpcBody(text: string): ParsedRpc {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return { invalid: errorReply(null, { code: -32700, message: "parse error" }) }
  }
  if (Array.isArray(body)) {
    if (body.length === 0) return { invalid: errorReply(null, { code: -32600, message: "empty batch" }) }
    if (body.length > MAX_BATCH) return { invalid: errorReply(null, { code: -32600, message: `batches are limited to ${MAX_BATCH} calls` }) }
    return { batch: true, slots: body.map(slotFor) }
  }
  return { batch: false, slots: [slotFor(body)] }
}

/** The calls to forward, in order (the host re-ids them so responses match even when callers reuse ids). */
export function forwardable(slots: RpcSlot[]): RpcCall[] {
  return slots.flatMap((s) => ("forward" in s ? [s.forward] : []))
}

/** Puts the anvil responses (in forwarded order) back into the caller's order with the caller's ids. */
export function assemble(slots: RpcSlot[], forwardedResponses: unknown[]): RpcResponse[] {
  let i = 0
  return slots.map((s) => {
    if ("reply" in s) return s.reply
    const res = forwardedResponses[i++] as Partial<RpcResponse> | undefined
    const id = s.forward.id
    if (!res || typeof res !== "object") return errorReply(id, { code: -32603, message: "the sandbox chain did not answer" })
    return res.error ? errorReply(id, sanitizeError(res.error)) : { jsonrpc: "2.0", id, result: res.result ?? null }
  })
}

/** Keeps anvil's revert data (wallets decode custom errors from it) but bounds the message size. */
function sanitizeError(e: unknown): RpcError & { data?: unknown } {
  const err = (e ?? {}) as { code?: unknown; message?: unknown; data?: unknown }
  const code = typeof err.code === "number" ? err.code : -32603
  const message = typeof err.message === "string" ? err.message.slice(0, 500) : "request failed"
  return err.data !== undefined ? { code, message, data: err.data } : { code, message }
}
