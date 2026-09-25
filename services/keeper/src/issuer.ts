/**
 * Issuer adapters. XStocksIssuer is the one central poller of the xStocks public API: a browser User-Agent,
 * a 30 s cache on asset metadata and the multiplier, single-flight requests, a per-minute request budget under
 * the shared ~1,000 req/min limit, and backoff on 429/5xx that respects Retry-After. RecordedIssuer serves
 * recorded responses (checks/fixtures/issuer) through the same parser.
 */
import { z } from "zod"
import { ISSUER_API } from "@intatto/config/xlayer"
import { parseIssuer, parseQuote, type IssuerRaw, type IssuerReading } from "./issuer-parse.ts"
import type { Ticker } from "./types.ts"

export interface IssuerAdapter {
  /** Reads every issuer input for `symbol`; `now` (unix seconds) stamps fetchedAt. Throws IssuerError. */
  read(symbol: Ticker, now: () => number): Promise<IssuerReading>
}

export type IssuerErrorCode = "rate-limited" | "server" | "http" | "network" | "backoff" | "budget" | "parse"

export class IssuerError extends Error {
  constructor(
    message: string,
    readonly code: IssuerErrorCode,
    readonly status: number | null = null,
    /** Unix seconds before which the adapter will not call the API again. */
    readonly retryAt: number | null = null,
  ) {
    super(message)
    this.name = "IssuerError"
  }
}

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

export type XStocksOptions = {
  baseUrl?: string
  fetch?: typeof fetch
  userAgent?: string
  /** Milliseconds clock for cache, budget and backoff (injectable for tests). */
  clock?: () => number
  metadataTtlMs?: number
  /** Our own share of the issuer's ~1,000 req/min limit. */
  maxRequestsPerMinute?: number
  timeoutMs?: number
}

/** Retry-After as milliseconds from `nowMs` (delta seconds or an HTTP date); null when absent or unreadable. */
export function parseRetryAfter(value: string | null, nowMs: number): number | null {
  if (!value) return null
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000
  const at = Date.parse(value)
  return Number.isNaN(at) ? null : Math.max(0, at - nowMs)
}

export class XStocksIssuer implements IssuerAdapter {
  private readonly base: string
  private readonly fetchImpl: typeof fetch
  private readonly clock: () => number
  private readonly ttl: number
  private readonly budget: number
  private readonly timeoutMs: number
  private readonly userAgent: string
  private cache = new Map<string, { at: number; body: unknown }>()
  private inflight = new Map<string, Promise<unknown>>()
  private blockedUntil = 0
  private failures = 0
  private window = { start: 0, count: 0 }
  /** Requests actually sent (for tests and /health). */
  requests = 0

  constructor(opts: XStocksOptions = {}) {
    this.base = (opts.baseUrl ?? ISSUER_API).replace(/\/$/, "")
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init))
    this.clock = opts.clock ?? (() => Date.now())
    this.ttl = opts.metadataTtlMs ?? 30_000
    this.budget = opts.maxRequestsPerMinute ?? 600
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.userAgent = opts.userAgent ?? BROWSER_USER_AGENT
  }

  async read(symbol: Ticker, now: () => number): Promise<IssuerReading> {
    const raw = await this.raw(symbol)
    try {
      return parseIssuer(symbol, raw, now())
    } catch {
      throw new IssuerError(`the issuer's ${symbol} responses did not match the expected shape`, "parse")
    }
  }

  /** Only the price-data quote (USD per token, 18 dec). */
  async quote(symbol: Ticker): Promise<bigint | null> {
    const body = await this.get(`/public/assets/${encodeURIComponent(symbol)}/price-data`, false)
    try {
      return parseQuote(body)
    } catch {
      throw new IssuerError(`the issuer's ${symbol} price-data did not match the expected shape`, "parse")
    }
  }

  /** The four raw bodies, as recorded in fixtures. */
  async raw(symbol: Ticker): Promise<IssuerRaw> {
    const s = encodeURIComponent(symbol)
    const [priceData, asset, status, multiplier] = await Promise.all([
      this.get(`/public/assets/${s}/price-data`, false),
      this.get(`/public/assets/${s}`, true),
      this.get(`/public/system/status/${s}`, false),
      this.get(`/public/assets/${s}/multiplier?network=XLayer`, true),
    ])
    return { priceData, asset, status, multiplier }
  }

  private get(path: string, cacheable: boolean): Promise<unknown> {
    if (cacheable) {
      const hit = this.cache.get(path)
      if (hit && this.clock() - hit.at < this.ttl) return Promise.resolve(hit.body)
    }
    const pending = this.inflight.get(path)
    if (pending) return pending
    const p = this.fetchJson(path)
      .then((body) => {
        if (cacheable) this.cache.set(path, { at: this.clock(), body })
        return body
      })
      .finally(() => this.inflight.delete(path))
    this.inflight.set(path, p)
    return p
  }

  private async fetchJson(path: string): Promise<unknown> {
    const t = this.clock()
    if (t < this.blockedUntil) {
      throw new IssuerError("backing off the issuer API after an error", "backoff", null, Math.ceil(this.blockedUntil / 1000))
    }
    if (t - this.window.start >= 60_000) this.window = { start: t, count: 0 }
    if (this.window.count >= this.budget) {
      throw new IssuerError("this minute's issuer request budget is spent", "budget", null, Math.ceil((this.window.start + 60_000) / 1000))
    }
    this.window.count++
    this.requests++
    let res: Response
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        headers: { "user-agent": this.userAgent, accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw new IssuerError("the issuer API did not answer", "network", null, this.fail(null))
    }
    this.noteRateLimit(res.headers)
    if (res.status === 429 || res.status >= 500) {
      const retryAt = this.fail(res.headers.get("retry-after"))
      throw new IssuerError(`the issuer API answered ${res.status}`, res.status === 429 ? "rate-limited" : "server", res.status, retryAt)
    }
    if (!res.ok) throw new IssuerError(`the issuer API answered ${res.status}`, "http", res.status)
    this.failures = 0
    try {
      return await res.json()
    } catch {
      throw new IssuerError("the issuer API did not return JSON", "parse", res.status)
    }
  }

  /** Exponential backoff from 30 s (max 10 min), or exactly what Retry-After asks. Returns retryAt (unix s). */
  private fail(retryAfter: string | null): number {
    const t = this.clock()
    const asked = parseRetryAfter(retryAfter, t)
    // Concurrent requests failing together are one failure: only a failure outside a backoff escalates it.
    if (t < this.blockedUntil && asked === null) return Math.ceil(this.blockedUntil / 1000)
    this.failures++
    const waitMs = asked !== null ? Math.max(asked, 1_000) : Math.min(30_000 * 2 ** (this.failures - 1), 600_000)
    this.blockedUntil = Math.max(this.blockedUntil, t + waitMs)
    return Math.ceil(this.blockedUntil / 1000)
  }

  /** Stops early when the shared limit is nearly spent, until the window the API reports resets. */
  private noteRateLimit(h: Headers) {
    const remaining = Number(h.get("x-ratelimit-remaining"))
    const reset = Date.parse(h.get("x-ratelimit-reset") ?? "")
    if (h.get("x-ratelimit-remaining") !== null && remaining <= 20 && !Number.isNaN(reset)) {
      this.blockedUntil = Math.max(this.blockedUntil, reset)
    }
  }
}

/** A recorded fixture file under checks/fixtures/issuer. */
export const issuerFixtureSchema = z.object({
  label: z.string(),
  symbol: z.enum(["NVDAx", "SPYx"]),
  synthetic: z.boolean(),
  recordedAt: z.string(),
  derivedFrom: z.string().optional(),
  changes: z.array(z.string()).optional(),
  responses: z.object({ priceData: z.unknown(), asset: z.unknown(), status: z.unknown(), multiplier: z.unknown() }),
})
export type IssuerFixture = z.infer<typeof issuerFixtureSchema>

/** Serves recorded responses through the same parser the live adapter uses. */
export class RecordedIssuer implements IssuerAdapter {
  constructor(private readonly bySymbol: Partial<Record<Ticker, IssuerRaw>>) {}

  async read(symbol: Ticker, now: () => number): Promise<IssuerReading> {
    const raw = this.bySymbol[symbol]
    if (!raw) throw new IssuerError(`no recorded issuer responses for ${symbol}`, "http", 404)
    return parseIssuer(symbol, raw, now())
  }
}
