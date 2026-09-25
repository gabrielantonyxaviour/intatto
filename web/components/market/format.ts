/**
 * Display helpers for the Market screen. Pure (viem only, relative imports) so checks/ui/market.spec.ts formats
 * contract reads exactly the way the page prints them.
 */
import { formatTokenAmount, formatUtc } from "../ui/web3/format.ts"

const USDG_DECIMALS = 6
const TEN_USDG = 10n * 10n ** 6n
const TEN_TOKENS = 10n * 10n ** 18n

const abs = (v: bigint) => (v < 0n ? -v : v)

/**
 * USDG (6 decimals). From 10 USDG up: cents. Below 10: every digit the token has (trailing zeros trimmed to two),
 * so a small balance reads 1.4975 USDG rather than 1.49.
 */
export function usdg(value: bigint, fractionDigits?: number): string {
  const digits = fractionDigits ?? (abs(value) < TEN_USDG ? USDG_DECIMALS : 2)
  return `${formatTokenAmount(value, USDG_DECIMALS, { maxFractionDigits: digits, minFractionDigits: 2 })} USDG`
}

/** Every USDG digit (up to 6 decimals): for numbers that must equal a contract read exactly, like borrow capacity. */
export function usdgExact(value: bigint): string {
  return usdg(value, USDG_DECIMALS)
}

/**
 * Two USDG amounts shown side by side ("holds … / owes …", "… of …"): the fewest decimals (from two) at which
 * unequal amounts also read unequal, so a comparison never shows the same number on both sides.
 */
export function usdgPair(a: bigint, b: bigint): [string, string] {
  const base = abs(a) < TEN_USDG || abs(b) < TEN_USDG ? USDG_DECIMALS : 2
  for (let digits = base; digits <= USDG_DECIMALS; digits++) {
    const pair: [string, string] = [usdg(a, digits), usdg(b, digits)]
    if (a === b || pair[0] !== pair[1]) return pair
  }
  return [usdg(a, USDG_DECIMALS), usdg(b, USDG_DECIMALS)]
}

/** The Borrow screen with this market selected. */
export function borrowHref(symbol: string): string {
  return `/borrow?market=${encodeURIComponent(symbol)}`
}

/** $226.18: a USD price with 18 decimals, truncated to cents. */
export function usdPrice(valueE18: bigint): string {
  return `$${formatTokenAmount(valueE18, 18, { maxFractionDigits: 2, minFractionDigits: 2 })}`
}

/** 12.3456 NVDAx (18 decimals); below 10 tokens, six decimals so small collateral stays readable. */
export function tokens(value: bigint, symbol: string): string {
  const digits = abs(value) < TEN_TOKENS ? 6 : 4
  return `${formatTokenAmount(value, 18, { maxFractionDigits: digits })} ${symbol}`
}

/** Basis points as a percentage with two decimals: 2812n → "28.12%". */
export function bps(value: bigint | number): string {
  const n = typeof value === "bigint" ? Number(value) : value
  return `${(n / 100).toFixed(2)}%`
}

/** Whole-percent form for fixed parameters: 6500n → "65%", 2812n → "28.12%". */
export function bpsShort(value: bigint | number): string {
  const n = typeof value === "bigint" ? Number(value) : value
  return n % 100 === 0 ? `${n / 100}%` : bps(n)
}

/** Seconds as "30 min", "6 h", "64 h". */
export function duration(seconds: bigint | number): string {
  const s = Number(seconds)
  if (s % 3600 === 0) return `${s / 3600} h`
  if (s % 60 === 0) return `${s / 60} min`
  return `${s} s`
}

/** "4 min ago", "2 h 5 min ago", "just now"; `now` and `then` in unix seconds. */
export function ago(now: number, then: number): string {
  const d = Math.max(0, now - then)
  if (d < 60) return "just now"
  const minutes = Math.floor(d / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h ${minutes % 60} min ago`
  return `${Math.floor(hours / 24)} days ago`
}

/** Signed difference of `a` from `ref` in basis points (float, for display only). */
export function diffBps(a: bigint, ref: bigint): number {
  if (ref === 0n) return Number.NaN
  return Number(((a - ref) * 1_000_000n) / ref) / 100
}

/** Collateral tokens behind `shares` wrapper shares, given convertToAssets(1e18). */
export function sharesToTokens(shares: bigint, assetsPerShare: bigint): bigint {
  return (shares * assetsPerShare) / 10n ** 18n
}

export { formatUtc }
