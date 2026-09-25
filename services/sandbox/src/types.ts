/**
 * Shared shapes for the sandbox service. Portable (no Node or Workers APIs): the Worker, the per-session
 * Durable Object and the local Node server all use these.
 */
import type { Address, Hex } from "viem"
import type { LedgerEntry } from "../../../checks/fork/lib/chain.ts"

export type { LedgerEntry }

/** How long a session may sit idle before its chain is stopped (the container's sleepAfter matches). */
export const IDLE_MINUTES = 30

export type SessionStatus = "starting" | "active" | "expired" | "failed"

export type WarpTarget = "saturday" | "monday" | { seconds: number }
export const SCENARIOS = ["corporate-action", "corporate-action-activate", "gap-2025-01", "synthetic-gap"] as const
export type ScenarioName = (typeof SCENARIOS)[number]

/** What a session's chain status reads as right now. */
export type ChainStatus = {
  chainTime: number
  block: number
  forkBlock: number
  session: string
  burnerAddress: Address | null
}

/** Incremental scan of CollateralMarket Borrowed logs. `scannedTo` is the last block included. */
export type BorrowerScan = { scannedTo: number; addresses: Address[] }

/** Serializable runtime state of one session, persisted between admin calls. */
export type SandboxSessionState = {
  burnerAddress?: Address
  /** evm_snapshot id taken right after start(); reset() reverts to it. */
  snapshotId?: Hex
  /** Accounts the sandbox keeper checks for liquidation after a price move. */
  watch: Address[]
  /** Every address that has ever borrowed, cached so later scans only read new blocks. */
  borrowers?: BorrowerScan
  pendingAction?: { activationAt: number; ratio: number }
  /** Wall-clock ms of the last keeper refresh (session + prices). */
  keeperAt?: number
}

export type SessionRow = {
  id: string
  createdAt: string
  lastActiveAt: string
  burnerAddress: Address | null
  status: SessionStatus
  state: SandboxSessionState
}

/**
 * Reaches one session's anvil. Locally it is a process on a port; on Cloudflare it is a container behind a
 * Durable Object, which the global fetch cannot reach, so the adapter supplies a fetch that routes to it.
 */
export type ContainerAdapter = {
  /** Starts the session's anvil from the snapshot and resolves once it answers JSON-RPC. */
  start(sessionId: string): Promise<void>
  stop(sessionId: string): Promise<void>
  adminRpcUrl(sessionId: string): string
  adminFetch?(sessionId: string): typeof fetch
}

export type CreatedSession = {
  sessionId: string
  burnerKey: Hex
  burnerAddress: Address
  entries: LedgerEntry[]
}

export type SessionInfo = {
  sessionId: string
  status: SessionStatus
  createdAt: string
  lastActiveAt: string
  burnerAddress: Address | null
  chain: ChainStatus | null
}

export type ActionResult = { sessionId: string; entries: LedgerEntry[]; chain: ChainStatus | null }

/** A JSON-RPC request the public proxy has already validated and allowed. */
export type RpcCall = { jsonrpc: "2.0"; id: string | number | null; method: string; params?: unknown }

/** Everything the HTTP router needs; implemented in-process locally and by Durable Object stubs on Cloudflare. */
export type SessionHost = {
  create(sessionId: string): Promise<CreatedSession>
  info(sessionId: string): Promise<SessionInfo>
  warp(sessionId: string, target: WarpTarget): Promise<ActionResult>
  scenario(sessionId: string, name: ScenarioName): Promise<ActionResult>
  reset(sessionId: string): Promise<ActionResult>
  ledger(sessionId: string): Promise<LedgerEntry[]>
  /** Forwards allowed calls to the session's anvil; returns one response per call, in order. */
  rpc(sessionId: string, calls: RpcCall[]): Promise<unknown[]>
}

/** An error the API can show: an HTTP status, a stable code and a person-readable message (never raw RPC text). */
export class SandboxError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "SandboxError"
  }
}

/** Durable Object RPC loses custom error fields, so DO methods return this and the caller rethrows. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; code: string; error: string }

export async function outcome<T>(fn: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    if (e instanceof SandboxError) return { ok: false, status: e.status, code: e.code, error: e.message }
    return { ok: false, status: 500, code: "internal", error: "the sandbox could not complete this request" }
  }
}

export function unwrap<T>(o: Outcome<T>): T {
  if (o.ok) return o.value
  throw new SandboxError(o.status, o.code, o.error)
}
