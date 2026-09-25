/**
 * Pure parsing of the xStocks public API (https://api.xstocks.fi/api/v2) into what the keeper posts.
 * No I/O here: the HTTP adapter and the recorded-fixture adapter both feed raw bodies through parseIssuer.
 */
import { parseUnits } from "viem"
import { z } from "zod"
import { sessionFromIssuer, type Session } from "@intatto/config/session"
import { calendarSession } from "../../../checks/fork/lib/clock.ts"
import type { Ticker } from "./types.ts"

export const ISSUER_PERIODS = ["market", "extended", "overnight", "closed"] as const
export type IssuerPeriod = (typeof ISSUER_PERIODS)[number]

/** GET /public/assets/{SYM}/price-data */
export const priceDataSchema = z.object({ quote: z.number().finite().nullable().optional() }).passthrough()

/** GET /public/assets/{SYM} (only the fields the keeper reads; the rest passes through). */
export const assetSchema = z
  .object({
    symbol: z.string(),
    isTradingHalted: z.boolean().nullable().optional(),
    trading: z
      .object({
        isTradingHalted: z.boolean().nullable().optional(),
        currentPeriod: z.string().nullable().optional(),
        openNow: z.boolean().nullable().optional(),
        nextChangeAt: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough()

/** GET /public/system/status/{SYM} */
export const statusSchema = z
  .object({ symbol: z.string(), isMarketTradingHalted: z.boolean(), isAtomicTradingHalted: z.boolean() })
  .passthrough()

/** GET /public/assets/{SYM}/multiplier?network=XLayer — activationDateTime is 0 when nothing is scheduled. */
export const multiplierSchema = z
  .object({
    currentMultiplier: z.number().finite().nullable(),
    newMultiplier: z.number().finite().nullable(),
    activationDateTime: z.union([z.number(), z.string()]).nullable(),
    reason: z.string().nullable().optional(),
  })
  .passthrough()

export type IssuerRaw = { priceData: unknown; asset: unknown; status: unknown; multiplier: unknown }

export type PendingAction = { activationAt: number; expectedMultiplierE18: bigint; reason: string | null }

export type IssuerReading = {
  symbol: Ticker
  /** USD per token, 18 decimals; null when the issuer gives no quote. */
  quoteE18: bigint | null
  period: string | null
  openNow: boolean | null
  session: Session
  halted: boolean
  haltFlags: { asset: boolean; trading: boolean; status: boolean; atomic: boolean }
  /** Why the inputs cannot be posted as they are (null when they agree). */
  disagreement: string | null
  /** Unix seconds the mapped session's period began (calendar when it matches, else the fetch time). */
  periodChangedAt: number
  nextChangeAt: number | null
  currentMultiplierE18: bigint | null
  pendingAction?: PendingAction
  /** Unix seconds the responses were read. */
  fetchedAt: number
}

/** A JSON number (e.g. 226.3225 or 1.001701196801074) as an exact 18-decimal integer. */
export function decimalToE18(n: number): bigint {
  if (!Number.isFinite(n)) throw new Error("not a finite number")
  let s = String(n)
  if (/e/i.test(s)) s = n.toFixed(18)
  const [whole, frac = ""] = s.split(".")
  return parseUnits(frac ? `${whole}.${frac.slice(0, 18)}` : whole, 18)
}

/** activationDateTime as unix seconds: 0/null = none; numbers above 1e12 are milliseconds; strings are ISO. */
export function parseActivation(v: number | string | null): number | null {
  if (v === null || v === 0 || v === "" || v === "0") return null
  if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v)
  if (/^\d+$/.test(v)) return parseActivation(Number(v))
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

export function parseQuote(priceData: unknown): bigint | null {
  const p = priceDataSchema.parse(priceData)
  if (p.quote === null || p.quote === undefined || p.quote <= 0) return null
  return decimalToE18(p.quote)
}

function isoSeconds(v: string | null | undefined): number | null {
  if (!v) return null
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

/**
 * Parses the four issuer responses. Halted = any market-halt flag (asset, trading or system status); an
 * atomic-swap-only halt is recorded but is not a market halt. Inputs disagree when the quote is missing, when
 * the halt flags contradict each other while the period says "market", when the period says "market" but the
 * issuer is not open, or when the period is one we do not map.
 */
export function parseIssuer(symbol: Ticker, raw: IssuerRaw, fetchedAt: number): IssuerReading {
  const asset = assetSchema.parse(raw.asset)
  const status = statusSchema.parse(raw.status)
  const mult = multiplierSchema.parse(raw.multiplier)
  const quoteE18 = parseQuote(raw.priceData)

  const trading = asset.trading ?? null
  const period = trading?.currentPeriod ?? null
  const openNow = trading?.openNow ?? null
  const haltFlags = {
    asset: asset.isTradingHalted === true,
    trading: trading?.isTradingHalted === true,
    status: status.isMarketTradingHalted,
    atomic: status.isAtomicTradingHalted,
  }
  const marketFlags = [haltFlags.asset, haltFlags.trading, haltFlags.status]
  const halted = marketFlags.some(Boolean)
  const session = sessionFromIssuer(period, halted)

  let disagreement: string | null = null
  if (quoteE18 === null) disagreement = "the issuer returned no quote"
  else if (halted && period === "market" && !marketFlags.every(Boolean))
    disagreement = `halt flags disagree while the period says market (asset ${haltFlags.asset}, trading ${haltFlags.trading}, status ${haltFlags.status})`
  else if (!halted && period === "market" && openNow === false) disagreement = "the period says market but openNow is false"
  else if (!halted && !ISSUER_PERIODS.includes(period as IssuerPeriod)) disagreement = `unmapped issuer period "${period ?? "none"}"`

  const calendar = calendarSession(fetchedAt)
  const periodChangedAt = calendar.session === session ? calendar.periodChangedAt : fetchedAt

  const activationAt = parseActivation(mult.activationDateTime)
  const pendingAction =
    activationAt !== null && activationAt > fetchedAt && mult.newMultiplier !== null && mult.newMultiplier > 0
      ? { activationAt, expectedMultiplierE18: decimalToE18(mult.newMultiplier), reason: mult.reason ?? null }
      : undefined

  return {
    symbol,
    quoteE18,
    period,
    openNow,
    session,
    halted,
    haltFlags,
    disagreement,
    periodChangedAt,
    nextChangeAt: isoSeconds(trading?.nextChangeAt),
    currentMultiplierE18: mult.currentMultiplier !== null && mult.currentMultiplier > 0 ? decimalToE18(mult.currentMultiplier) : null,
    ...(pendingAction ? { pendingAction } : {}),
    fetchedAt,
  }
}
