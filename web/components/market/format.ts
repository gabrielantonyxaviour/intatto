/**
 * Display helpers for the Market screen. Pure (viem only) so checks/ui/market.spec.ts can reproduce
 * exactly what the page prints from a contract read.
 */
import { formatTokenAmount, formatUtc } from "@/components/ui/web3/format"

/** 50,000.00 USDG (6 decimals, truncated to cents). */
export function usdg(value: bigint): string {
  return `${formatTokenAmount(value, 6, { maxFractionDigits: 2, minFractionDigits: 2 })} USDG`
}

/** $226.18: a USD price with 18 decimals, truncated to cents. */
export function usdPrice(valueE18: bigint): string {
  return `$${formatTokenAmount(valueE18, 18, { maxFractionDigits: 2, minFractionDigits: 2 })}`
}

/** 12.3456 NVDAx (18 decimals). */
export function tokens(value: bigint, symbol: string): string {
  return `${formatTokenAmount(value, 18, { maxFractionDigits: 4 })} ${symbol}`
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
