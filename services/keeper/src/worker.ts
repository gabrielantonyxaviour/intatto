/**
 * intatto-keeper: a Cloudflare Worker on a one-minute Cron Trigger. `scheduled` runs one keeper cycle with the
 * operator key (secret OPERATOR_PK, never logged) against LIVE_DEPLOYMENT; cursors and the action log live in
 * the KeeperState Durable Object. `fetch` serves GET /log, GET /health, POST /receipt and GET /receipts
 * (JSON, CORS open; POST /receipt checks the RECEIPT_TOKEN secret and stores no header values).
 */
import { createPublicClient, createWalletClient, fallback, http, type Chain, type PublicClient, type WalletClient } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { xLayer } from "viem/chains"
import { z } from "zod"
import { parseDeployment, type Deployment } from "@intatto/config/deployments"
import { xlayerRpcUrls } from "@intatto/config/xlayer"
import { shortError } from "./chain.ts"
import { runCycle } from "./cycle.ts"
import { XStocksIssuer } from "./issuer.ts"
import { handleReceiptHttp } from "./receipts.ts"
import type { KeeperState } from "./state-do.ts"

export { KeeperState } from "./state-do.ts"

export type Env = {
  KEEPER_STATE: DurableObjectNamespace<KeeperState>
  OPERATOR_PK?: string
  LIVE_DEPLOYMENT?: string
  XLAYER_RPC_URL?: string
  SEND_REJECTED?: string
  /** Shared with the credit API. Absent means POST /receipt answers 401. */
  RECEIPT_TOKEN?: string
}

/** Module scope: one issuer poller per isolate, so its cache and backoff survive between invocations. */
const issuer = new XStocksIssuer()
/** Longer than a slow cycle (receipt waits time out at 90 s), so cycles never overlap; released at the end. */
const LEASE_MS = 3 * 60_000
const STALE_AFTER_SEC = 180

const stateOf = (env: Env) => env.KEEPER_STATE.get(env.KEEPER_STATE.idFromName("keeper"))

const configSchema = z.object({
  OPERATOR_PK: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  LIVE_DEPLOYMENT: z.string().min(2),
  XLAYER_RPC_URL: z.string().url().optional(),
  SEND_REJECTED: z.enum(["true", "false"]).optional(),
})

/** Reads the Worker's config; errors name the variable, never its value. */
function readConfig(env: Env): { ok: true; pk: `0x${string}`; deployment: Deployment } | { ok: false; error: string } {
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) return { ok: false, error: `keeper not configured: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")} missing or malformed` }
  try {
    return { ok: true, pk: parsed.data.OPERATOR_PK as `0x${string}`, deployment: parseDeployment(JSON.parse(parsed.data.LIVE_DEPLOYMENT)) }
  } catch {
    return { ok: false, error: "keeper not configured: LIVE_DEPLOYMENT is not a valid deployment JSON" }
  }
}

export async function scheduledCycle(env: Env): Promise<void> {
  const state = stateOf(env)
  const at = new Date().toISOString()
  const config = readConfig(env)
  if (!config.ok) {
    await state.append({ at, market: "all", kind: "skipped", detail: config.error })
    return
  }
  if (!(await state.acquire(LEASE_MS))) return // the previous cycle is still running
  const started = Date.now()
  try {
    const { deployment } = config
    const account = privateKeyToAccount(config.pk)
    if (account.address.toLowerCase() !== deployment.keeper.toLowerCase()) {
      await state.append({ at, market: "all", kind: "skipped", detail: `operator ${account.address} is not the deployment's keeper ${deployment.keeper}; nothing sent` })
      return
    }
    const chain = { ...xLayer, id: deployment.chainId } as Chain
    const transport = fallback(xlayerRpcUrls({ XLAYER_RPC_URL: env.XLAYER_RPC_URL }).map((url) => http(url, { retryCount: 1, timeout: 15_000 })))
    const result = await runCycle({
      publicClient: createPublicClient({ chain, transport }) as PublicClient,
      walletClient: createWalletClient({ account, chain, transport }) as WalletClient,
      deployment,
      issuer,
      log: (a) => state.append(a),
      now: () => Math.floor(Date.now() / 1000),
      state: { get: (k) => state.getValue(k), set: (k, v) => state.setValue(k, v) },
      options: { sendRejected: env.SEND_REJECTED === "true" },
    })
    await state.finishCycle({
      at: result.at,
      chainTime: result.chainTime,
      actions: result.actions.length,
      sent: result.actions.filter((a) => a.txHash).length,
      failures: result.failures,
      durationMs: Date.now() - started,
    })
  } catch (e) {
    await state.append({ at, market: "all", kind: "skipped", detail: `cycle failed, next minute retries: ${shortError(e)}` })
  } finally {
    await state.release()
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-receipt-token",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS } })

const logQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) })

export async function handleFetch(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  const url = new URL(request.url)
  try {
    const receipt = await handleReceiptHttp(request, env, stateOf(env))
    if (receipt) return receipt
    if (request.method !== "GET") return json({ error: "method not allowed", code: "method_not_allowed" }, 405)
    if (url.pathname === "/log") {
      const q = logQuery.safeParse({ limit: url.searchParams.get("limit") ?? undefined })
      if (!q.success) return json({ error: "limit must be an integer from 1 to 500", code: "bad_limit" }, 400)
      return json({ actions: await stateOf(env).recent(q.data.limit) })
    }
    if (url.pathname === "/health") {
      const { lastCycle, actions } = await stateOf(env).health()
      const age = lastCycle ? Math.floor(Date.now() / 1000) - Math.floor(Date.parse(lastCycle.at) / 1000) : null
      const ok = age !== null && age <= STALE_AFTER_SEC
      return json({ ok, service: "intatto-keeper", lastCycle, lastCycleAgeSec: age, loggedActions: actions }, ok ? 200 : 503)
    }
    return json({ error: "not found", code: "not_found" }, 404)
  } catch {
    return json({ error: "the keeper state is unavailable", code: "state_unavailable" }, 503)
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(scheduledCycle(env))
  },
  fetch: handleFetch,
}
