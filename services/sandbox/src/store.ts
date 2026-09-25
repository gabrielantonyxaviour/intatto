/**
 * Session rows and the divergence ledger in SQLite. On Cloudflare each session's Durable Object keeps its own
 * copy in `ctx.storage.sql`; the local server uses node:sqlite. Both are synchronous, behind one tiny interface.
 * Portable: no Node or Workers imports.
 */
import type { Address } from "viem"
import type { LedgerEntry, SandboxSessionState, SessionRow, SessionStatus } from "./types.ts"

type SqlValue = string | number | null
export type Sql = { exec(query: string, ...params: SqlValue[]): Record<string, unknown>[] }

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sandbox_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    burner_address TEXT,
    status TEXT NOT NULL,
    state_json TEXT NOT NULL DEFAULT '{"watch":[]}'
  )`,
  `CREATE TABLE IF NOT EXISTS sandbox_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    at TEXT NOT NULL,
    chain_time INTEGER NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail_json TEXT,
    tx_hash TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS sandbox_ledger_by_session ON sandbox_ledger (session_id, id)`,
]

/** BigInts (token amounts) are written as decimal strings. */
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x))

export class SessionStore {
  constructor(private sql: Sql) {
    for (const statement of SCHEMA) sql.exec(statement)
  }

  insert(row: SessionRow) {
    this.sql.exec(
      "INSERT INTO sandbox_sessions (id, created_at, last_active_at, burner_address, status, state_json) VALUES (?, ?, ?, ?, ?, ?)",
      row.id,
      row.createdAt,
      row.lastActiveAt,
      row.burnerAddress,
      row.status,
      json(row.state),
    )
  }

  get(id: string): SessionRow | null {
    const [r] = this.sql.exec("SELECT * FROM sandbox_sessions WHERE id = ?", id)
    if (!r) return null
    return {
      id: String(r.id),
      createdAt: String(r.created_at),
      lastActiveAt: String(r.last_active_at),
      burnerAddress: (r.burner_address as Address | null) ?? null,
      status: String(r.status) as SessionStatus,
      state: JSON.parse(String(r.state_json)) as SandboxSessionState,
    }
  }

  update(id: string, patch: Partial<Pick<SessionRow, "lastActiveAt" | "burnerAddress" | "status" | "state">>) {
    const row = this.get(id)
    if (!row) return
    const next = { ...row, ...patch }
    this.sql.exec(
      "UPDATE sandbox_sessions SET last_active_at = ?, burner_address = ?, status = ?, state_json = ? WHERE id = ?",
      next.lastActiveAt,
      next.burnerAddress,
      next.status,
      json(next.state),
      id,
    )
  }

  appendLedger(sessionId: string, e: LedgerEntry) {
    this.sql.exec(
      "INSERT INTO sandbox_ledger (session_id, at, chain_time, kind, summary, detail_json, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
      sessionId,
      e.at,
      e.chainTime,
      e.kind,
      e.summary,
      e.detail ? json(e.detail) : null,
      e.txHash ?? null,
    )
  }

  ledger(sessionId: string): LedgerEntry[] {
    return this.sql.exec("SELECT * FROM sandbox_ledger WHERE session_id = ? ORDER BY id", sessionId).map((r) => ({
      kind: String(r.kind) as LedgerEntry["kind"],
      summary: String(r.summary),
      ...(r.detail_json ? { detail: JSON.parse(String(r.detail_json)) as Record<string, unknown> } : {}),
      ...(r.tx_hash ? { txHash: r.tx_hash as LedgerEntry["txHash"] } : {}),
      chainTime: Number(r.chain_time),
      at: String(r.at),
    }))
  }
}
