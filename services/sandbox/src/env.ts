/** The Worker's bindings (wrangler.jsonc). */
import type { SandboxContainer } from "./container.ts"
import type { SandboxSessionDO } from "./session-do.ts"

export type Env = {
  /** One container per session: anvil with the snapshot loaded. */
  SANDBOX_CONTAINER: DurableObjectNamespace<SandboxContainer>
  /** One Durable Object per session: its row, its ledger (SQLite storage) and its admin actions. */
  SANDBOX_SESSION: DurableObjectNamespace<SandboxSessionDO>
  /** X Layer mainnet RPC the containers' anvil forks from. */
  UPSTREAM_RPC: string
}
