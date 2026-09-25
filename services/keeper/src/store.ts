/**
 * The keeper's durable log and state over SQLite (portable). The Worker runs it inside the KeeperState Durable
 * Object on ctx.storage.sql; checks run it on node:sqlite through the same SqlExec shape. The schema is
 * services/keeper/migrations/0001_init.sql.
 */
import { z } from "zod"
import { ACTION_KINDS, type KeeperAction, type KeeperState } from "./types.ts"

/** The subset of Durable Object SqlStorage (ctx.storage.sql) the store uses. */
export interface SqlExec {
  exec(query: string, ...bindings: (string | number | null)[]): { toArray(): Record<string, unknown>[] }
}

export const keeperActionSchema = z.object({
  at: z.string().min(1).max(40),
  market: z.enum(["NVDAx", "SPYx", "all"]),
  kind: z.enum(ACTION_KINDS),
  detail: z.string().min(1).max(2_000),
  data: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
})

export type CycleSummary = { at: string; chainTime: number; actions: number; sent: number; failures: number; durationMs: number }

/** Splits a migration into statements (drops `--` comment lines). */
export function schemaStatements(schema: string): string[] {
  return schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
}

export class SqlKeeperStore implements KeeperState {
  constructor(
    private readonly sql: SqlExec,
    private readonly clockMs: () => number = () => Date.now(),
  ) {}

  migrate(schema: string) {
    for (const statement of schemaStatements(schema)) this.sql.exec(statement)
  }

  getSync(key: string): string | null {
    const rows = this.sql.exec("SELECT value FROM keeper_state WHERE key = ?", key).toArray()
    return rows.length ? String(rows[0].value) : null
  }

  setSync(key: string, value: string) {
    this.sql.exec(
      "INSERT INTO keeper_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      key,
      value,
      Math.floor(this.clockMs() / 1000),
    )
  }

  async get(key: string) {
    return this.getSync(key)
  }

  async set(key: string, value: string) {
    this.setSync(key, value)
  }

  /** Validates and appends one action (the Worker hands actions over RPC, so this is a boundary). */
  append(input: unknown): KeeperAction {
    const a = keeperActionSchema.parse(input)
    this.sql.exec(
      "INSERT INTO keeper_actions (at, market, kind, detail, data, tx_hash) VALUES (?, ?, ?, ?, ?, ?)",
      a.at,
      a.market,
      a.kind,
      a.detail,
      a.data ? JSON.stringify(a.data) : null,
      a.txHash ?? null,
    )
    return a as KeeperAction
  }

  /** Newest first. */
  recent(limit: number): (KeeperAction & { id: number })[] {
    const rows = this.sql.exec("SELECT id, at, market, kind, detail, data, tx_hash FROM keeper_actions ORDER BY id DESC LIMIT ?", limit).toArray()
    return rows.map((r) => ({
      id: Number(r.id),
      at: String(r.at),
      market: String(r.market) as KeeperAction["market"],
      kind: String(r.kind) as KeeperAction["kind"],
      detail: String(r.detail),
      ...(r.data ? { data: JSON.parse(String(r.data)) as KeeperAction["data"] } : {}),
      ...(r.tx_hash ? { txHash: String(r.tx_hash) as `0x${string}` } : {}),
    }))
  }

  count(): number {
    return Number(this.sql.exec("SELECT COUNT(*) AS n FROM keeper_actions").toArray()[0]?.n ?? 0)
  }

  /** A cycle lease: false while another cycle holds an unexpired one. Callers run it without awaiting between. */
  acquireLock(ttlMs: number): boolean {
    const now = this.clockMs()
    if (Number(this.getSync("lock") ?? 0) > now) return false
    this.setSync("lock", String(now + ttlMs))
    return true
  }

  releaseLock() {
    this.setSync("lock", "0")
  }

  /** Records the cycle and keeps the log to its newest `keep` rows. */
  finishCycle(summary: CycleSummary, keep = 50_000) {
    this.setSync("last_cycle", JSON.stringify(summary))
    this.sql.exec("DELETE FROM keeper_actions WHERE id <= (SELECT MAX(id) FROM keeper_actions) - ?", keep)
  }

  lastCycle(): CycleSummary | null {
    const raw = this.getSync("last_cycle")
    return raw ? (JSON.parse(raw) as CycleSummary) : null
  }
}
