/**
 * One sandbox session on Cloudflare: its row and divergence ledger in this Durable Object's SQLite storage, its
 * admin actions serialized here, and its chain in a SandboxContainer reached through that container's Durable
 * Object. Methods return an Outcome because Durable Object RPC drops custom error fields.
 */
import { DurableObject } from "cloudflare:workers"
import { getContainer } from "@cloudflare/containers"
import metaJson from "../container/snapshot/meta.json" with { type: "json" }
import type { Env } from "./env.ts"
import { SessionService } from "./service.ts"
import { parseSnapshotMeta } from "./snapshot.ts"
import { SessionStore } from "./store.ts"
import { outcome, type ContainerAdapter, type RpcCall, type ScenarioName, type WarpTarget } from "./types.ts"

const meta = parseSnapshotMeta(metaJson)
/** The container is reached through its Durable Object, not this host; the name only fills the request line. */
const ANVIL_URL = "http://anvil.internal/"

export class SandboxSessionDO extends DurableObject<Env> {
  private service: SessionService

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const sql = ctx.storage.sql
    const store = new SessionStore({ exec: (query, ...params) => sql.exec(query, ...params).toArray() })
    const container = (id: string) => getContainer(this.env.SANDBOX_CONTAINER, id)
    const adapter: ContainerAdapter = {
      start: (id) => container(id).boot(id),
      stop: (id) => container(id).shutdown(),
      adminRpcUrl: () => ANVIL_URL,
      adminFetch: (id) =>
        (async (input: RequestInfo | URL, init?: RequestInit) => {
          // Rebuild without the AbortSignal: it cannot cross into the container's Durable Object.
          const req = new Request(input, init)
          return container(id).fetch(new Request(req.url, { method: req.method, headers: req.headers, body: await req.text() }))
        }) as typeof fetch,
    }
    this.service = new SessionService({ adapter, store, meta })
  }

  create(id: string) {
    return outcome(() => this.service.create(id))
  }

  info(id: string) {
    return outcome(() => this.service.info(id))
  }

  warp(id: string, target: WarpTarget) {
    return outcome(() => this.service.warp(id, target))
  }

  scenario(id: string, name: ScenarioName) {
    return outcome(() => this.service.scenario(id, name))
  }

  reset(id: string) {
    return outcome(() => this.service.reset(id))
  }

  ledger(id: string) {
    return outcome(() => this.service.ledger(id))
  }

  rpc(id: string, calls: RpcCall[]) {
    return outcome(() => this.service.rpc(id, calls))
  }

  /** Called by SandboxContainer.onStop: sleepAfter, a crash or a redeploy ended the chain. */
  containerStopped(id: string, reason: string) {
    return this.service.containerStopped(id, reason)
  }
}
