/**
 * One sandbox chain: anvil forked from X Layer with the snapshot loaded (container/Dockerfile), one container
 * per session. Its Durable Object only boots, proxies and reports; session logic lives in SandboxSessionDO.
 */
import { Container, type StopParams } from "@cloudflare/containers"
import type { Env } from "./env.ts"
import { IDLE_MINUTES } from "./types.ts"

const SESSION_KEY = "intatto:sessionId"
export const ANVIL_PORT = 8545

export class SandboxContainer extends Container<Env> {
  defaultPort = ANVIL_PORT
  sleepAfter = `${IDLE_MINUTES}m`
  enableInternet = true // anvil lazily reads untouched mainnet state from the upstream RPC

  /** Starts anvil for `sessionId` and resolves once it answers on its port. */
  async boot(sessionId: string): Promise<void> {
    await this.ctx.storage.put(SESSION_KEY, sessionId)
    await this.startAndWaitForPorts({
      ports: ANVIL_PORT,
      startOptions: { envVars: { UPSTREAM_RPC: this.env.UPSTREAM_RPC, SESSION_ID: sessionId } },
      // First boot pulls the fork block from the upstream RPC and loads the snapshot.
      cancellationOptions: { instanceGetTimeoutMS: 60_000, portReadyTimeoutMS: 120_000, waitInterval: 500 },
    })
  }

  async shutdown(): Promise<void> {
    if (this.ctx.container?.running) await this.stop()
  }

  /**
   * Proxies JSON-RPC to anvil, but never starts a container: once a session's chain has stopped its state is
   * gone, and silently booting a fresh snapshot under the same session would lose the burner's funds.
   */
  override async fetch(request: Request): Promise<Response> {
    if (!this.ctx.container?.running) {
      return new Response(JSON.stringify({ error: "this session's chain is not running", code: "session_expired" }), {
        status: 410,
        headers: { "content-type": "application/json" },
      })
    }
    return this.containerFetch(request, ANVIL_PORT)
  }

  override async onStop(params: StopParams): Promise<void> {
    const sessionId = await this.ctx.storage.get<string>(SESSION_KEY)
    if (!sessionId) return
    const stub = this.env.SANDBOX_SESSION.get(this.env.SANDBOX_SESSION.idFromName(sessionId))
    await stub.containerStopped(sessionId, `${params.reason}, exit code ${params.exitCode}`)
  }

  override onError(error: unknown): void {
    // Startup failures reach SandboxSessionDO.create through boot(); rethrow so it records and reports them.
    throw error
  }
}
