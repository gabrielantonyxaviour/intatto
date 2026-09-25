/**
 * Client for the sandbox session API (services/sandbox): every response is validated before the screen uses it,
 * and every failure becomes a SandboxApiError with a stable code and a sentence a person can read.
 */
import { z } from "zod"
import { deploymentSchema } from "@intatto/config/deployments"

/** Must stay a literal `process.env.NEXT_PUBLIC_…` read so Next inlines it at build time. */
export const DEFAULT_SANDBOX_API_URL = (process.env.NEXT_PUBLIC_SANDBOX_API_URL ?? "").trim() || "https://intatto-rpc.larinova.com"

export const WARP_TARGETS = ["saturday", "monday", "hour"] as const
export type WarpId = (typeof WARP_TARGETS)[number]
export const SCENARIO_NAMES = ["gap-2025-01", "corporate-action", "corporate-action-activate", "synthetic-gap"] as const
export type ScenarioName = (typeof SCENARIO_NAMES)[number]

export type AdminRequest = { kind: "warp"; target: WarpId } | { kind: "scenario"; name: ScenarioName } | { kind: "reset" }
export const requestKey = (r: AdminRequest) => (r.kind === "warp" ? `warp:${r.target}` : r.kind === "scenario" ? `scenario:${r.name}` : "reset")

const chainStatusSchema = z.object({
  chainTime: z.number(),
  block: z.number(),
  forkBlock: z.number(),
  session: z.string(),
  burnerAddress: z.string().nullable(),
})
export type ChainStatus = z.infer<typeof chainStatusSchema>

export const ledgerEntrySchema = z.object({
  kind: z.string(),
  summary: z.string(),
  detail: z.record(z.unknown()).optional(),
  txHash: z.string().optional(),
  chainTime: z.number(),
  at: z.string(),
})
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

const healthSchema = z.object({
  ok: z.boolean(),
  chainId: z.number().int(),
  forkBlock: z.number().int(),
  snapshotCreatedAt: z.string().optional(),
  markets: z.array(z.string()).optional(),
})
export type Health = z.infer<typeof healthSchema>

const createdSchema = z.object({
  sessionId: z.string().min(1),
  rpcUrl: z.string().url(),
  chainId: z.number().int(),
  forkBlock: z.number().int().nonnegative(),
  deployment: deploymentSchema,
  burnerKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  burnerAddress: z.string(),
  expiresAfterIdleMinutes: z.number().optional(),
})
export type CreatedSession = z.infer<typeof createdSchema>

export const SESSION_STATUSES = ["starting", "active", "expired", "failed"] as const
const sessionInfoSchema = z.object({
  sessionId: z.string(),
  status: z.enum(SESSION_STATUSES),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  burnerAddress: z.string().nullable(),
  chain: chainStatusSchema.nullable(),
  expiresAfterIdleMinutes: z.number().optional(),
})
export type SessionInfo = z.infer<typeof sessionInfoSchema>

const ledgerSchema = z.object({ sessionId: z.string(), entries: z.array(ledgerEntrySchema) })
const actionSchema = z.object({ sessionId: z.string(), entries: z.array(ledgerEntrySchema), chain: chainStatusSchema.nullable() })
export type ActionResult = z.infer<typeof actionSchema>

export class SandboxApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "SandboxApiError"
  }
}

/** Codes after which the session cannot be used again: the screen offers a new one. */
const GONE = new Set(["session_expired", "session_failed", "session_not_found", "invalid_session_id"])
export const isSessionGone = (e: unknown) => e instanceof SandboxApiError && (e.status === 410 || GONE.has(e.code))
export const isUnreachable = (e: unknown) => e instanceof SandboxApiError && e.code === "unreachable"

/** An http(s) base URL without a trailing slash, or null. */
export function normalizeApiUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "")
  } catch {
    return null
  }
}

const errorBody = z.object({ error: z.string(), code: z.string().optional() })
const READ_TIMEOUT_MS = 20_000
/** Starting a fork, the Jan 2025 replay and the synthetic gap each take a while on the server. */
const ACTION_TIMEOUT_MS = 300_000

async function call<T>(base: string, path: string, schema: z.ZodType<T>, init?: { body?: unknown; timeoutMs?: number }): Promise<T> {
  const host = (() => {
    try {
      return new URL(base).host
    } catch {
      return base
    }
  })()
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      method: init ? "POST" : "GET",
      headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init?.timeoutMs ?? READ_TIMEOUT_MS),
    })
  } catch {
    throw new SandboxApiError(0, "unreachable", `The sandbox service at ${host} did not answer.`)
  }
  const raw: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const parsed = errorBody.safeParse(raw)
    throw new SandboxApiError(
      res.status,
      parsed.success ? (parsed.data.code ?? "error") : "error",
      parsed.success ? parsed.data.error : `The sandbox service answered with HTTP ${res.status}.`,
    )
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new SandboxApiError(res.status, "bad_response", `The sandbox service at ${host} answered in a shape this page does not understand.`)
  return parsed.data
}

const id = (sessionId: string) => encodeURIComponent(sessionId)

export const sandboxApi = {
  health: (base: string) => call(base, "/health", healthSchema),
  create: (base: string) => call(base, "/session", createdSchema, { timeoutMs: ACTION_TIMEOUT_MS }),
  info: (base: string, sessionId: string) => call(base, `/session/${id(sessionId)}`, sessionInfoSchema),
  ledger: async (base: string, sessionId: string) => (await call(base, `/session/${id(sessionId)}/ledger`, ledgerSchema)).entries,
  warp: (base: string, sessionId: string, target: WarpId) =>
    call(base, `/session/${id(sessionId)}/warp`, actionSchema, {
      body: { target: target === "hour" ? { seconds: 3600 } : target },
      timeoutMs: ACTION_TIMEOUT_MS,
    }),
  scenario: (base: string, sessionId: string, name: ScenarioName) =>
    call(base, `/session/${id(sessionId)}/scenario`, actionSchema, { body: { name }, timeoutMs: ACTION_TIMEOUT_MS }),
  reset: (base: string, sessionId: string) => call(base, `/session/${id(sessionId)}/reset`, actionSchema, { body: {}, timeoutMs: ACTION_TIMEOUT_MS }),
}

/** Sends one fork-control method to the public RPC to show it is refused. */
export async function probeAdminMethod(rpcUrl: string, method: string): Promise<{ refused: boolean; code?: number; message: string }> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    })
    const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string }; result?: unknown } | null
    if (body?.error) return { refused: true, code: body.error.code, message: body.error.message ?? "refused" }
    return { refused: false, message: "the RPC accepted it" }
  } catch {
    return { refused: false, message: "the RPC did not answer" }
  }
}
