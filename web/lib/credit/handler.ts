/**
 * GET /api/credit and GET /api/credit/health, as plain Request → Response functions (no Next-only APIs),
 * so the route files stay one line and checks can call them in plain Node.
 */
import { computeCredit } from "./compute"
import { liveDeployment, mainnetClient, resolveChain } from "./deployment"
import { CreditError, errorResponse, fromError, json, processEnv, type Env } from "./http"
import { paywall } from "./paywall"
import { parseCreditQuery, parseHealthQuery } from "./query"

function searchParams(req: Request): URLSearchParams {
  try {
    return new URL(req.url).searchParams
  } catch {
    return new URLSearchParams()
  }
}

/** What a bare call (no parameters, GET or POST) receives: a free 200 describing how to ask. */
export function serviceDescription(req: Request): Response {
  const base = (() => {
    try {
      const u = new URL(req.url)
      return `${u.origin}${u.pathname}`
    } catch {
      return "https://intatto.larinova.com/api/credit"
    }
  })()
  return json({
    service: "intatto-credit",
    version: "1",
    description: "How much a wallet can borrow right now against tokenized stocks on X Layer, and what gap would liquidate it.",
    method: "GET",
    parameters: {
      wallet: "required, 0x address",
      market: "required, NVDAx | SPYx",
      network: "optional, mainnet (default) | sandbox",
      session: "optional, sandbox session id (network=sandbox)",
    },
    example: `${base}?wallet=0x7F23b131F7312bd0f63EF79974E215Dc3E12a415&market=NVDAx`,
    price: "free",
  })
}

export async function handleCredit(req: Request, env: Env = processEnv()): Promise<Response> {
  const params = searchParams(req)
  if ([...params.keys()].length === 0) return serviceDescription(req)
  const parsed = parseCreditQuery(params)
  if (!parsed.ok) return errorResponse(400, parsed.error, parsed.code)
  const gate = paywall(req, env)
  if (gate) return gate
  try {
    const { client, deployment, network } = await resolveChain(parsed.query, env)
    const report = await computeCredit(client, deployment, parsed.query.wallet, parsed.query.market, { network })
    return json(report)
  } catch (e) {
    return fromError(e)
  }
}

/** Free in every mode. ok = the chain answers and a deployment is configured for the network. */
export async function handleHealth(req: Request, env: Env = processEnv()): Promise<Response> {
  const parsed = parseHealthQuery(searchParams(req))
  if (!parsed.ok) return errorResponse(400, parsed.error, parsed.code)
  const { network } = parsed.query
  try {
    if (network === "mainnet") {
      const block = await blockOf(mainnetClient(env).getBlockNumber())
      let deployed = false
      try {
        deployed = liveDeployment(env) !== null
      } catch (e) {
        if (!(e instanceof CreditError)) throw e
        return json({ ok: false, network, block, error: e.message, code: e.code }, e.status)
      }
      if (!deployed) return json({ ok: false, network, block, error: "Intatto is not deployed on mainnet yet", code: "NOT_DEPLOYED" }, 503)
      return json({ ok: true, network, block })
    }
    const { client } = await resolveChain(parsed.query, env)
    return json({ ok: true, network, block: await blockOf(client.getBlockNumber()) })
  } catch (e) {
    const r = e instanceof CreditError ? e : new CreditError(503, "Could not read the chain right now. Try again in a moment.", "CHAIN_UNAVAILABLE")
    return json({ ok: false, network, block: null, error: r.message, code: r.code }, r.status)
  }
}

async function blockOf(p: Promise<bigint>): Promise<number> {
  return Number(await p)
}
