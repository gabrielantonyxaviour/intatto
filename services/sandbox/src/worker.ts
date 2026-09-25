/**
 * intatto-sandbox Worker: the hosted fork sandbox API (sessions, time travel, scenarios, ledger) and each
 * session's public JSON-RPC. Stateless: every session call goes to that session's Durable Object.
 */
import metaJson from "../container/snapshot/meta.json" with { type: "json" }
import type { Env } from "./env.ts"
import { createRouter } from "./router.ts"
import { parseSnapshotMeta } from "./snapshot.ts"
import { unwrap, type Outcome, type SessionHost } from "./types.ts"

export { SandboxContainer } from "./container.ts"
export { SandboxSessionDO } from "./session-do.ts"

const meta = parseSnapshotMeta(metaJson)

function durableHost(env: Env): SessionHost {
  const session = (id: string) => env.SANDBOX_SESSION.get(env.SANDBOX_SESSION.idFromName(id))
  // Durable Object RPC results are structured clones of the Outcome the object returned.
  const run = async <T>(o: Promise<unknown>) => unwrap((await o) as Outcome<T>)
  return {
    create: (id) => run(session(id).create(id)),
    info: (id) => run(session(id).info(id)),
    warp: (id, target) => run(session(id).warp(id, target)),
    scenario: (id, name) => run(session(id).scenario(id, name)),
    reset: (id) => run(session(id).reset(id)),
    ledger: (id) => run(session(id).ledger(id)),
    rpc: (id, calls) => run(session(id).rpc(id, calls)),
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createRouter({ host: durableHost(env), meta })(request)
  },
} satisfies ExportedHandler<Env>
