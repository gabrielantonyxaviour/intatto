/** Copy and the call log for the Agents screen. Counts live in this browser only. */

export const SERVICE_NAME = "Intatto credit and health"
export const SERVICE_DESCRIPTION =
  "Read a wallet's borrowing room, the session limit, and how far the price is from liquidation."
export const SERVICE_DOMAIN = "intatto.larinova.com"
export const PUBLIC_ORIGIN = "https://intatto.larinova.com"
export const PRICE_LABEL = "Free"
export const PAYMENT_NOTE = "x402 on X Layer (eip155:196) after a real paid settlement is proven"
export const LISTING_STATUS = "OKX AI listing: under review (agent #13907)"
export const AGENT_LABEL = "agent #13907"
export const REGISTRATION_TX = "0xe1d2770368121cdc5457fcb6adaabdaedf57f7ecd804ca73916bfb0c1dc2b3c7"
export const DEMO_WALLET = "0x7F23b131F7312bd0f63EF79974E215Dc3E12a415"
export const KEEPER_ROLE = "Posts the market session, the relayed price and the ticker caps, and runs bounded liquidations."
export const KEEPER_IDENTITY = "OKX AI agent #13907"

export const PRICE_SOURCE =
  "Keeper relay of the xStocks issuer's indicative quote (a trusted relayer, bounded onchain). The issuer quote has no source timestamp."

/** Short form of okx-ai/README.md. The listing is under review; no client is wired into this page. */
export const A2MCP_SUMMARY = [
  "The OKX AI listing is under review (agent #13907), submitted 2026-09-25.",
  "An agent would GET https://intatto.larinova.com/api/credit for one wallet: collateral, debt, loan-to-value, health, USDG it can borrow now, and how far the price can fall before liquidation.",
  "wallet and market are required. network (mainnet or sandbox) and session are optional.",
  "The price is 0. GET /api/credit/health is always free.",
  "Paid x402 mode is written but off until a real settlement is proven.",
  "No client is wired up here. curl is the call you can make today.",
].join(" ")

export type Endpoint = {
  method: "GET"
  path: string
  tags: string[]
  description: string
}

export const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/credit",
    tags: ["credit", "health"],
    description: "Session, capacity, keeper price, guards, and liquidation distance for one wallet.",
  },
  {
    method: "GET",
    path: "/api/credit/health",
    tags: ["health"],
    description: "Whether this service can read the chain right now.",
  },
]

export const PARAMETERS = [
  { name: "wallet", required: true, values: "0x address", note: "40 hex characters, all lowercase or checksummed." },
  { name: "market", required: true, values: "NVDAx or SPYx", note: "SPYx is listed only in the sandbox." },
  { name: "network", required: false, values: "mainnet or sandbox", note: "Defaults to mainnet." },
  { name: "session", required: false, values: "sandbox session id", note: "Sent with sandbox calls so the service can find that fork." },
] as const

const CALLS_KEY = "intatto:agents:credit-calls"

export type CallLog = { at: string; wallet: string; market: string }

export function readCalls(): CallLog[] {
  try {
    const raw = localStorage.getItem(CALLS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return []
      const r = row as Partial<CallLog>
      if (typeof r.at !== "string" || typeof r.wallet !== "string" || typeof r.market !== "string") return []
      return [{ at: r.at, wallet: r.wallet, market: r.market }]
    })
  } catch {
    return []
  }
}

export function recordCall(entry: CallLog): CallLog[] {
  const next = [entry, ...readCalls()].slice(0, 20)
  localStorage.setItem(CALLS_KEY, JSON.stringify(next))
  return next
}

export function creditQuery(q: { wallet: string; market: string; network: string; session?: string }): string {
  const params = new URLSearchParams({ wallet: q.wallet, market: q.market, network: q.network })
  if (q.session) params.set("session", q.session)
  return `/api/credit?${params.toString()}`
}

export function curlFor(url: string): string {
  return `curl -sS "${url}"`
}

export function publicEndpointUrl(path: string): string {
  return `${PUBLIC_ORIGIN}${path}`
}
