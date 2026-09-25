/**
 * Shapes shared by the keeper's portable core (cycle, steps, issuer) and its Worker shell.
 */
import type { MarketDeployment } from "@intatto/config/deployments"

export type Ticker = MarketDeployment["symbol"]

export const ACTION_KINDS = ["session", "price", "price-rejected", "cap", "action", "liquidation", "backoff", "skipped"] as const
export type ActionKind = (typeof ACTION_KINDS)[number]

/** One line of the keeper's action log. `detail` is a sentence for people; `data` holds the numbers. */
export type KeeperAction = {
  /** ISO time of the cycle that produced it. */
  at: string
  /** Ticker symbol, or "all" for cycle-wide lines. */
  market: Ticker | "all"
  kind: ActionKind
  detail: string
  data?: Record<string, string | number | boolean | null>
  txHash?: `0x${string}`
}

export type ActionLog = (action: KeeperAction) => void | Promise<void>

/** Small durable key/value store for cursors and last-post memory (D1 in the Worker, a Map in checks). */
export interface KeeperState {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export class MemoryState implements KeeperState {
  readonly values = new Map<string, string>()
  async get(key: string) {
    return this.values.get(key) ?? null
  }
  async set(key: string, value: string) {
    this.values.set(key, value)
  }
}

/** Reads and writes a JSON value under `key`; a missing or unreadable value reads as null. */
export async function getJson<T>(state: KeeperState, key: string): Promise<T | null> {
  const raw = await state.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setJson(state: KeeperState, key: string, value: unknown): Promise<void> {
  return state.set(key, JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)))
}
