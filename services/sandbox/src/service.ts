/**
 * Session lifecycle over a container adapter and a SQLite store: create, idle expiry, serialized admin actions,
 * the lazy sandbox keeper and the JSON-RPC forward. Portable: the local server runs it in-process for every
 * session; on Cloudflare each session's Durable Object runs it for its one session.
 */
import type { SnapshotMeta } from "./snapshot.ts"
import { SandboxSession } from "./session.ts"
import type { SessionStore } from "./store.ts"
import {
  IDLE_MINUTES,
  SandboxError,
  type ActionResult,
  type ContainerAdapter,
  type CreatedSession,
  type LedgerEntry,
  type RpcCall,
  type SandboxSessionState,
  type ScenarioName,
  type SessionHost,
  type SessionInfo,
  type SessionRow,
  type WarpTarget,
} from "./types.ts"

const TOUCH_EVERY_MS = 60_000
const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 300)

export type ServiceDeps = { adapter: ContainerAdapter; store: SessionStore; meta: SnapshotMeta; now?: () => number }

export class SessionService implements SessionHost {
  private locks = new Map<string, Promise<unknown>>()
  private now: () => number

  constructor(private deps: ServiceDeps) {
    this.now = deps.now ?? Date.now
  }

  private open(id: string, state?: SandboxSessionState) {
    const { adapter, store, meta } = this.deps
    return new SandboxSession({
      adminRpcUrl: adapter.adminRpcUrl(id),
      fetchFn: adapter.adminFetch?.(id),
      chainId: meta.chainId,
      forkBlock: meta.forkBlock,
      deployment: meta.deployment,
      sink: (e) => store.appendLedger(id, e),
      state,
      now: this.now,
    })
  }

  private note(id: string, summary: string, chainTime = 0, detail?: Record<string, unknown>) {
    this.deps.store.appendLedger(id, { kind: "note", summary, chainTime, at: new Date(this.now()).toISOString(), ...(detail ? { detail } : {}) })
  }

  async create(id: string): Promise<CreatedSession> {
    const { adapter, store, meta } = this.deps
    if (store.get(id)) throw new SandboxError(409, "session_exists", "a session with this id already exists")
    const at = new Date(this.now()).toISOString()
    store.insert({ id, createdAt: at, lastActiveAt: at, burnerAddress: null, status: "starting", state: { watch: [] } })
    // The snapshot's own divergence (deploy, seeding, the USDG staleness note) opens every session's ledger.
    for (const e of meta.ledger) store.appendLedger(id, { ...e, detail: { ...e.detail, from: "snapshot" } } as LedgerEntry)
    this.note(id, `session started from the snapshot of X Layer block ${meta.forkBlock} built ${meta.createdAt}`, meta.snapshotChainTime, {
      forkBlock: meta.forkBlock,
      snapshotBlock: meta.snapshotBlock,
      stateSha256: meta.stateSha256,
    })
    try {
      await adapter.start(id)
      const s = this.open(id)
      const { burnerKey, burnerAddress } = await s.start()
      store.update(id, { status: "active", burnerAddress, state: s.state, lastActiveAt: new Date(this.now()).toISOString() })
      return { sessionId: id, burnerKey, burnerAddress, entries: s.fork.ledger.entries }
    } catch (e) {
      store.update(id, { status: "failed" })
      this.note(id, `session start failed: ${firstLine(e)}`)
      await adapter.stop(id).catch(() => undefined)
      throw new SandboxError(502, "start_failed", "the sandbox chain could not be started; try again")
    }
  }

  async info(id: string): Promise<SessionInfo> {
    let row = this.row(id)
    let chain = null
    if (row.status === "active") {
      try {
        row = this.active(id)
        chain = await this.open(id, row.state).status()
      } catch (e) {
        if (!(e instanceof SandboxError)) this.note(id, `status read failed: ${firstLine(e)}`)
        row = this.row(id)
      }
    }
    return { sessionId: id, status: row.status, createdAt: row.createdAt, lastActiveAt: row.lastActiveAt, burnerAddress: row.burnerAddress, chain }
  }

  warp(id: string, target: WarpTarget) {
    return this.admin(id, "warp", (s) => s.warp(target))
  }

  scenario(id: string, name: ScenarioName) {
    return this.admin(id, `${name} scenario`, (s) => s.scenario(name))
  }

  reset(id: string) {
    return this.admin(id, "reset", (s) => s.reset())
  }

  async ledger(id: string): Promise<LedgerEntry[]> {
    this.row(id)
    return this.deps.store.ledger(id)
  }

  /** Called when the platform reports the session's container stopped (sleepAfter, crash or redeploy). */
  async containerStopped(id: string, reason: string) {
    const row = this.deps.store.get(id)
    if (row?.status === "active") this.expire(id, `the session's chain stopped (${reason})`)
  }

  async rpc(id: string, calls: RpcCall[]): Promise<unknown[]> {
    const row = this.active(id)
    const stale = !row.state.keeperAt || this.now() - row.state.keeperAt >= 10 * 60_000
    if (stale && !this.locks.has(id)) {
      // The sandbox keeper: session and price posts go stale after 30 minutes, so refresh them lazily.
      await this.serial(id, async () => {
        const s = this.open(id, this.row(id).state)
        if (await s.freshen()) this.deps.store.update(id, { state: s.state })
      }).catch((e) => this.note(id, `sandbox keeper refresh failed: ${firstLine(e)}`))
    }
    if (calls.length === 0) return []
    const { adapter } = this.deps
    const doFetch = adapter.adminFetch?.(id) ?? fetch
    let res: Response
    try {
      res = await doFetch(adapter.adminRpcUrl(id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(calls.map((c, i) => ({ ...c, id: i }))),
      })
    } catch {
      throw new SandboxError(502, "chain_unavailable", "the session's chain did not answer")
    }
    if (res.status === 410) {
      this.expire(id, "the session's chain was no longer running")
      throw new SandboxError(410, "session_expired", "this sandbox session has expired; start a new one")
    }
    const body = (await res.json().catch(() => null)) as { id?: number }[] | null
    if (!Array.isArray(body)) throw new SandboxError(502, "chain_unavailable", "the session's chain did not answer")
    const byId = new Map(body.map((r) => [Number(r?.id), r]))
    return calls.map((_c, i) => byId.get(i))
  }

  private row(id: string): SessionRow {
    const row = this.deps.store.get(id)
    if (!row) throw new SandboxError(404, "session_not_found", "no sandbox session with this id")
    return row
  }

  /** The row of a live session, after idle expiry; touches last_active_at at most once a minute. */
  private active(id: string): SessionRow {
    const row = this.row(id)
    if (row.status === "starting") throw new SandboxError(409, "session_starting", "this session is still starting")
    if (row.status === "failed") throw new SandboxError(410, "session_failed", "this session failed to start; start a new one")
    if (row.status === "expired") throw new SandboxError(410, "session_expired", `this sandbox session expired after ${IDLE_MINUTES} idle minutes; start a new one`)
    const idle = this.now() - Date.parse(row.lastActiveAt)
    if (idle > IDLE_MINUTES * 60_000) {
      this.expire(id, `idle for more than ${IDLE_MINUTES} minutes`)
      throw new SandboxError(410, "session_expired", `this sandbox session expired after ${IDLE_MINUTES} idle minutes; start a new one`)
    }
    if (idle > TOUCH_EVERY_MS) this.deps.store.update(id, { lastActiveAt: new Date(this.now()).toISOString() })
    return row
  }

  private expire(id: string, reason: string) {
    this.deps.store.update(id, { status: "expired" })
    this.note(id, `session expired: ${reason}`)
    void this.deps.adapter.stop(id).catch(() => undefined)
  }

  private async admin(id: string, label: string, fn: (s: SandboxSession) => Promise<void>): Promise<ActionResult> {
    return this.serial(id, async () => {
      const row = this.active(id)
      const s = this.open(id, row.state)
      try {
        await fn(s)
      } catch (e) {
        this.deps.store.update(id, { state: s.state })
        if (e instanceof SandboxError) throw e
        this.note(id, `${label} failed: ${firstLine(e)}`, await s.fork.chainTime().catch(() => 0))
        throw new SandboxError(502, "action_failed", `the ${label} could not be completed on the fork`)
      }
      this.deps.store.update(id, { state: s.state, lastActiveAt: new Date(this.now()).toISOString() })
      return { sessionId: id, entries: s.fork.ledger.entries, chain: await s.status().catch(() => null) }
    })
  }

  /** Runs admin work for one session one at a time (a warp must not interleave with a scenario). */
  private serial<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const run = (this.locks.get(id) ?? Promise.resolve()).catch(() => undefined).then(fn)
    const tail = run.catch(() => undefined)
    this.locks.set(id, tail)
    void tail.then(() => {
      if (this.locks.get(id) === tail) this.locks.delete(id)
    })
    return run
  }
}
