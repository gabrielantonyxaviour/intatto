import type { Session } from "@intatto/config/session"
import { formatTokenAmount } from "@/components/ui/web3/format"
import { isMaxUint } from "./math"

/** 1,234.56 USDG */
export const usdg = (x: bigint) => `${formatTokenAmount(x, 6, { maxFractionDigits: 2, minFractionDigits: 2 })} USDG`

/** $1,234.56 from a 6-decimal USDG value (USDG is the unit of account, shown as dollars only for prices). */
export const usd6 = (x: bigint) => `$${formatTokenAmount(x, 6, { maxFractionDigits: 2, minFractionDigits: 2 })}`

/** $226.19 from an 18-decimal USD price. */
export const price = (x: bigint) => `$${formatTokenAmount(x, 18, { maxFractionDigits: 2, minFractionDigits: 2 })}`

/**
 * Two amounts with just enough decimals that different values never print the same ("0.4012 USDG" vs "0.4031 USDG",
 * not "0.40" vs "0.40"). Starts at `minDigits`, goes up to the token's decimals.
 */
export function distinct(a: bigint, b: bigint, decimals: number, minDigits: number): [string, string] {
  for (let d = minDigits; d < decimals; d++) {
    const opts = { maxFractionDigits: d, minFractionDigits: minDigits }
    const fa = formatTokenAmount(a, decimals, opts)
    const fb = formatTokenAmount(b, decimals, opts)
    if (fa !== fb || a === b) return [fa, fb]
  }
  const full = { maxFractionDigits: decimals, minFractionDigits: minDigits }
  return [formatTokenAmount(a, decimals, full), formatTokenAmount(b, decimals, full)]
}

/** A USDG amount shown next to `other` with enough decimals to tell them apart. */
export const usdgVs = (x: bigint, other: bigint) => `${distinct(x, other, 6, 2)[0]} USDG`

/** A token amount (18 decimals) shown next to `other` with enough decimals to tell them apart. */
export const tokensVs = (x: bigint, other: bigint, symbol: string) => `${distinct(x, other, 18, 4)[0]} ${symbol}`

/** 35.00% from bps; ">999%" for an unbounded LTV (debt with no collateral). */
export function pct(bps: bigint): string {
  if (isMaxUint(bps) || bps > 99_900n) return ">999%"
  return `${(Number(bps) / 100).toFixed(2)}%`
}

/** Health factor with two decimals; "∞" with no debt. */
export function health(e18: bigint): string {
  if (isMaxUint(e18)) return "∞"
  return formatTokenAmount(e18, 18, { maxFractionDigits: 2, minFractionDigits: 2 })
}

/** Liquidation price, or "–" with no debt or no collateral. */
export const liqPrice = (e18: bigint) => (e18 === 0n ? "–" : price(e18))

const SESSION_WORDS: Record<Session, string> = {
  OPEN: "regular US trading hours",
  EXTENDED: "pre-market, after-hours or overnight trading",
  CLOSED: "the stock market is closed",
  HALTED: "trading in the stock is halted",
  CORPORATE_ACTION: "a split or dividend is being applied",
  UNKNOWN: "the keeper's session post is missing or too old",
}

export const sessionMeaning = (s: Session) => SESSION_WORDS[s]

/** "Mon 16:00 UTC" */
export function shortUtc(unix: number): string {
  const d = new Date(unix * 1000)
  if (Number.isNaN(d.getTime())) return "–"
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
  return `${day} ${d.toISOString().slice(11, 16)} UTC`
}
