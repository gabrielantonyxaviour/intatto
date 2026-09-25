/** The divergence ledger of a hosted sandbox session: every admin call it made, fetched as recorded. */
import { z } from "zod"

const entrySchema = z
  .object({
    kind: z.string(),
    summary: z.string(),
    chainTime: z.coerce.number().optional(),
    chain_time: z.coerce.number().optional(),
    txHash: z.string().nullish(),
    tx_hash: z.string().nullish(),
    at: z.string().optional(),
  })
  .passthrough()

const responseSchema = z.union([
  z.array(entrySchema),
  z.object({ entries: z.array(entrySchema) }).transform((r) => r.entries),
  z.object({ ledger: z.array(entrySchema) }).transform((r) => r.ledger),
])

export type LedgerRow = { kind: string; summary: string; chainTime: number | null; txHash: string | null; at: string | null }

export type LedgerState =
  | { status: "loading" }
  | { status: "none"; reason: string }
  | { status: "ok"; url: string; entries: LedgerRow[] }
  | { status: "error"; url: string; message: string }

export function ledgerUrl(apiUrl: string, sessionId: string): string {
  return `${apiUrl.replace(/\/+$/, "")}/session/${encodeURIComponent(sessionId)}/ledger`
}

export async function fetchLedger(apiUrl: string | null, sessionId: string | null): Promise<LedgerState> {
  if (!sessionId) {
    return { status: "none", reason: "No sandbox session: the ledger lists every mutation a session makes, so there is none to show." }
  }
  if (!apiUrl) {
    return {
      status: "none",
      reason:
        "This sandbox has no session API (a local fork), so there is no ledger to fetch. A hosted session lists every mutation it makes here.",
    }
  }
  const url = ledgerUrl(apiUrl, sessionId)
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const err = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`
      return { status: "error", url, message: err }
    }
    const parsed = responseSchema.safeParse(body)
    if (!parsed.success) return { status: "error", url, message: "the ledger response is not a list of entries" }
    const entries = parsed.data.map((e) => ({
      kind: e.kind,
      summary: e.summary,
      chainTime: e.chainTime ?? e.chain_time ?? null,
      txHash: e.txHash ?? e.tx_hash ?? null,
      at: e.at ?? null,
    }))
    return { status: "ok", url, entries }
  } catch (e) {
    return { status: "error", url, message: e instanceof Error ? e.message : String(e) }
  }
}

const healthSchema = z.object({ base: z.object({ sandboxOnlyMarkets: z.array(z.string()).optional() }).passthrough().optional() }).passthrough()

/**
 * Markets the hosted sandbox adds on top of the mainnet deployment (GET {apiUrl}/health → base.sandboxOnlyMarkets).
 * Only a label for check 4 when the app has no mainnet deployment to tell; empty when there is no session API.
 */
export async function fetchSandboxOnlyMarkets(apiUrl: string | null): Promise<string[]> {
  if (!apiUrl) return []
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/health`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const parsed = healthSchema.safeParse(await res.json())
    return parsed.success ? (parsed.data.base?.sandboxOnlyMarkets ?? []) : []
  } catch {
    return []
  }
}
