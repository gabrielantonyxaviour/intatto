/**
 * KeeperState: the SQLite-backed Durable Object that owns the keeper_actions and keeper_state tables. The
 * cron Worker talks to one named instance ("keeper") over RPC; each method runs without awaiting, so the
 * cycle lease is atomic.
 */
import { DurableObject } from "cloudflare:workers"
import schema from "../migrations/0001_init.sql"
import { SqlKeeperStore, type CycleSummary } from "./store.ts"

export class KeeperState extends DurableObject<unknown> {
  private readonly store: SqlKeeperStore

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env)
    this.store = new SqlKeeperStore(ctx.storage.sql)
    this.store.migrate(schema)
  }

  async getValue(key: string) {
    return this.store.getSync(key)
  }

  async setValue(key: string, value: string) {
    this.store.setSync(key, value)
  }

  async append(action: unknown) {
    this.store.append(action)
  }

  async recent(limit: number) {
    return this.store.recent(limit)
  }

  async acquire(ttlMs: number) {
    return this.store.acquireLock(ttlMs)
  }

  async release() {
    this.store.releaseLock()
  }

  async finishCycle(summary: CycleSummary) {
    this.store.finishCycle(summary)
  }

  async health() {
    return { lastCycle: this.store.lastCycle(), actions: this.store.count() }
  }
}
