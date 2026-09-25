/**
 * The sandbox API on a local port (Node): the same router and session service as the Worker, with one anvil
 * per session loaded from the snapshot (instead of a container) and node:sqlite for session rows and the ledger.
 *
 * Run: npx tsx services/sandbox/src/local.ts [--port 8788] [--snapshot <dir>]
 */
import { readFileSync } from "node:fs"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { startAnvil, type Anvil } from "../../../checks/fork/node/anvil.ts"
import { createRouter } from "./router.ts"
import { SessionService } from "./service.ts"
import { parseSnapshotMeta, type SnapshotMeta } from "./snapshot.ts"
import { SessionStore, type Sql } from "./store.ts"
import { SandboxError, type ContainerAdapter } from "./types.ts"

export const DEFAULT_SNAPSHOT_DIR = resolve(import.meta.dirname, "..", "container", "snapshot")

export type LocalSandbox = { url: string; meta: SnapshotMeta; service: SessionService; stop: () => Promise<void> }

/** One anvil per session, loaded from the snapshot: the local stand-in for a Cloudflare container. */
function localAdapter(meta: SnapshotMeta, statePath: string): ContainerAdapter & { stopAll(): Promise<void> } {
  const anvils = new Map<string, Anvil>()
  return {
    async start(id) {
      anvils.set(id, await startAnvil({ forkBlock: meta.forkBlock, loadState: statePath, chainId: meta.chainId }))
    },
    async stop(id) {
      await anvils.get(id)?.stop()
      anvils.delete(id)
    },
    adminRpcUrl(id) {
      const anvil = anvils.get(id)
      if (!anvil) throw new SandboxError(410, "session_expired", "this session's chain is not running; start a new session")
      return anvil.rpcUrl
    },
    async stopAll() {
      await Promise.all([...anvils.values()].map((a) => a.stop()))
      anvils.clear()
    },
  }
}

async function openSqlite(path: string): Promise<{ sql: Sql; close: () => void }> {
  // node:sqlite still announces itself as experimental on Node 24; that one warning is noise here.
  const emit = process.emitWarning.bind(process)
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    if (String(warning).includes("SQLite is an experimental feature")) return
    ;(emit as (...a: unknown[]) => void)(warning, ...rest)
  }) as typeof process.emitWarning
  const { DatabaseSync } = await import("node:sqlite")
  const db = new DatabaseSync(path)
  return {
    sql: { exec: (query, ...params) => db.prepare(query).all(...params) as Record<string, unknown>[] },
    close: () => db.close(),
  }
}

async function bridge(req: IncomingMessage, res: ServerResponse, handle: (r: Request) => Promise<Response>, base: string) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v)
  const method = req.method ?? "GET"
  const request = new Request(new URL(req.url ?? "/", base), {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
  })
  const response = await handle(request)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}

export async function startLocalSandbox(opts: { port?: number; snapshotDir?: string; dbPath?: string } = {}): Promise<LocalSandbox> {
  const dir = resolve(opts.snapshotDir ?? DEFAULT_SNAPSHOT_DIR)
  const meta = parseSnapshotMeta(JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")))
  const adapter = localAdapter(meta, join(dir, "state.json"))
  const db = await openSqlite(opts.dbPath ?? ":memory:")
  const service = new SessionService({ adapter, store: new SessionStore(db.sql), meta })
  const handle = createRouter({ host: service, meta })

  let base = "http://127.0.0.1"
  const server = createServer((req, res) => {
    bridge(req, res, handle, base).catch(() => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "the local sandbox could not answer", code: "internal" }))
    })
  })
  await new Promise<void>((ok) => server.listen(opts.port ?? 0, "127.0.0.1", ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const stop = async () => {
    await new Promise<void>((ok) => server.close(() => ok()))
    await adapter.stopAll()
    db.close()
  }
  return { url: base, meta, service, stop }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const sandbox = await startLocalSandbox({ port: Number(arg("--port") ?? process.env.PORT ?? 8788), snapshotDir: arg("--snapshot") })
  process.stdout.write(`intatto sandbox (local) on ${sandbox.url} — fork block ${sandbox.meta.forkBlock}, chain ${sandbox.meta.chainId}\n`)
  const shutdown = () => void sandbox.stop().then(() => process.exit(0))
  process.once("SIGINT", shutdown)
  process.once("SIGTERM", shutdown)
}
