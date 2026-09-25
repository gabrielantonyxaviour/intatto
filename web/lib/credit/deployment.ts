/**
 * Which chain and which Intatto deployment a credit request reads.
 * - mainnet: LIVE_DEPLOYMENT or NEXT_PUBLIC_LIVE_DEPLOYMENT (JSON, config Deployment) over the X Layer RPC list.
 * - sandbox: with a session id, `${SANDBOX_API_URL}/session/<id>` → { rpcUrl, chainId, deployment };
 *   without one, CREDIT_SANDBOX_RPC + CREDIT_SANDBOX_DEPLOYMENT (a local fork, as the check runs it).
 */
import { createPublicClient, fallback, http, type Chain, type PublicClient } from "viem"
import { xLayer as viemXLayer } from "viem/chains"
import { z } from "zod"
import { deploymentSchema, type Deployment } from "@intatto/config/deployments"
import { XLAYER_CHAIN_ID, xlayerRpcUrls } from "@intatto/config/xlayer"
import { CreditError, type Env } from "./http"
import type { CreditNetwork } from "./query"

export const DEFAULT_SANDBOX_API_URL = "https://intatto-rpc.larinova.com"

export type ResolvedChain = { network: CreditNetwork; client: PublicClient; deployment: Deployment }

const sessionResponse = z.object({
  rpcUrl: z.string().url(),
  chainId: z.number().int().positive(),
  deployment: deploymentSchema,
})

function parseDeploymentJson(raw: string, what: string): Deployment {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new CreditError(503, `The ${what} deployment is not valid JSON.`, "DEPLOYMENT_INVALID")
  }
  const parsed = deploymentSchema.safeParse(value)
  if (!parsed.success) throw new CreditError(503, `The ${what} deployment does not match the deployment schema.`, "DEPLOYMENT_INVALID")
  return parsed.data
}

function buildTimeLiveDeployment(): string | undefined {
  return typeof process !== "undefined" ? process.env.NEXT_PUBLIC_LIVE_DEPLOYMENT?.trim() : undefined
}

/** The configured mainnet deployment, or null while Intatto is not deployed on X Layer. */
export function liveDeployment(env: Env): Deployment | null {
  // The literal process.env read lets Next inline the public value at build time; `env` covers runtime vars.
  const raw = env.LIVE_DEPLOYMENT?.trim() || env.NEXT_PUBLIC_LIVE_DEPLOYMENT?.trim() || buildTimeLiveDeployment()
  if (!raw) return null
  const d = parseDeploymentJson(raw, "mainnet")
  if (d.chainId !== XLAYER_CHAIN_ID) throw new CreditError(503, "The mainnet deployment is not for chain 196.", "DEPLOYMENT_INVALID")
  return d
}

export function mainnetClient(env: Env): PublicClient {
  const urls = xlayerRpcUrls(env)
  const chain: Chain = { ...viemXLayer, id: XLAYER_CHAIN_ID, rpcUrls: { default: { http: urls } } }
  return createPublicClient({
    chain,
    transport: fallback(urls.map((u) => http(u, { retryCount: 1, timeout: 10_000 }))),
  }) as PublicClient
}

function forkClient(rpcUrl: string, chainId: number): PublicClient {
  const chain: Chain = { ...viemXLayer, id: chainId, name: "Intatto sandbox", rpcUrls: { default: { http: [rpcUrl] } } }
  return createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1, timeout: 15_000 }) }) as PublicClient
}

async function fetchSession(id: string, env: Env): Promise<z.infer<typeof sessionResponse>> {
  const base = (env.SANDBOX_API_URL?.trim() || DEFAULT_SANDBOX_API_URL).replace(/\/+$/, "")
  let res: Response
  try {
    res = await fetch(`${base}/session/${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new CreditError(503, "The sandbox service did not answer. Try again in a moment.", "SANDBOX_UNAVAILABLE")
  }
  if (res.status === 404) throw new CreditError(404, "That sandbox session does not exist or has expired.", "SESSION_NOT_FOUND")
  if (!res.ok) throw new CreditError(503, "The sandbox service could not open that session.", "SANDBOX_UNAVAILABLE")
  const parsed = sessionResponse.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new CreditError(503, "The sandbox service returned a session in an unexpected shape.", "SANDBOX_UNAVAILABLE")
  return parsed.data
}

export async function resolveChain(q: { network: CreditNetwork; session?: string }, env: Env): Promise<ResolvedChain> {
  if (q.network === "mainnet") {
    const deployment = liveDeployment(env)
    if (!deployment) throw new CreditError(503, "Intatto is not deployed on mainnet yet", "NOT_DEPLOYED")
    return { network: "mainnet", client: mainnetClient(env), deployment }
  }
  if (q.session) {
    const s = await fetchSession(q.session, env)
    return { network: "sandbox", client: forkClient(s.rpcUrl, s.chainId), deployment: s.deployment }
  }
  const rpc = env.CREDIT_SANDBOX_RPC?.trim()
  const raw = env.CREDIT_SANDBOX_DEPLOYMENT?.trim()
  if (!rpc || !raw) {
    throw new CreditError(400, "network=sandbox needs a session: pass session=<id> from the sandbox.", "SESSION_REQUIRED")
  }
  const deployment = parseDeploymentJson(raw, "sandbox")
  return { network: "sandbox", client: forkClient(rpc, deployment.chainId), deployment }
}
