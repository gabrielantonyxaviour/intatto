/** Query validation for GET /api/credit and GET /api/credit/health. */
import { getAddress, isAddress, type Address } from "viem"
import { z } from "zod"

export const MARKETS = ["NVDAx", "SPYx"] as const
export const NETWORKS = ["mainnet", "sandbox"] as const
export type CreditMarket = (typeof MARKETS)[number]
export type CreditNetwork = (typeof NETWORKS)[number]

const wallet = z
  .string({ required_error: "wallet is required: a 0x address" })
  .trim()
  // viem's strict check: all-lowercase hex, or a valid EIP-55 checksum when the case is mixed.
  .refine((v) => /^0x[0-9a-fA-F]{40}$/.test(v) && isAddress(v, { strict: true }), {
    message: "wallet must be a 0x address of 40 hex characters, all lowercase or EIP-55 checksummed",
  })
  .transform((v) => getAddress(v))

const market = z.enum(MARKETS, {
  errorMap: () => ({ message: "market is required and must be NVDAx or SPYx" }),
})

const network = z
  .enum(NETWORKS, { errorMap: () => ({ message: "network must be mainnet or sandbox" }) })
  .default("mainnet")

const session = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "session must be a sandbox session id (letters, digits, - and _, up to 64)")
  .optional()

/** An optional chain id must match the network: 196 for mainnet, 1960196 for the sandbox. */
const chain = z
  .string()
  .trim()
  .regex(/^\d{1,10}$/, "chain must be a chain id: 196 (mainnet) or 1960196 (sandbox)")
  .transform(Number)
  .optional()

const creditQuery = z
  .object({ wallet, market, network, session, chain })
  .refine((q) => !q.session || q.network === "sandbox", {
    message: "session applies only to network=sandbox",
    path: ["session"],
  })
  .refine((q) => q.chain === undefined || q.chain === (q.network === "sandbox" ? 1960196 : 196), {
    message: "chain does not match the network: use 196 for mainnet or 1960196 with network=sandbox",
    path: ["chain"],
  })

const healthQuery = z
  .object({ network, session })
  .refine((q) => !q.session || q.network === "sandbox", {
    message: "session applies only to network=sandbox",
    path: ["session"],
  })

export type CreditQuery = { wallet: Address; market: CreditMarket; network: CreditNetwork; session?: string }
export type HealthQuery = { network: CreditNetwork; session?: string }

type Parsed<T> = { ok: true; query: T } | { ok: false; error: string; code: string }

const CODES: Record<string, string> = {
  wallet: "INVALID_WALLET",
  market: "INVALID_MARKET",
  network: "INVALID_NETWORK",
  session: "INVALID_SESSION",
  chain: "WRONG_CHAIN",
}

/** Reads each known key once; an empty value counts as missing. Unknown keys are ignored. */
function pick(params: URLSearchParams, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const k of keys) {
    const v = params.get(k)
    out[k] = v === null || v.trim() === "" ? undefined : v
  }
  return out
}

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): Parsed<T> {
  const r = schema.safeParse(input)
  if (r.success) return { ok: true, query: r.data }
  const issue = r.error.issues[0]
  const key = String(issue?.path[0] ?? "")
  return { ok: false, error: issue?.message ?? "invalid query", code: CODES[key] ?? "INVALID_QUERY" }
}

export function parseCreditQuery(params: URLSearchParams): Parsed<CreditQuery> {
  return parse(creditQuery, pick(params, ["wallet", "market", "network", "session", "chain"])) as Parsed<CreditQuery>
}

export function parseHealthQuery(params: URLSearchParams): Parsed<HealthQuery> {
  return parse(healthQuery, pick(params, ["network", "session"])) as Parsed<HealthQuery>
}
