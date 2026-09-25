/** Formatting for the risk console. Every number carries its unit; bigints never pass through a float to display. */
import { formatTokenAmount, formatUtc } from "@/components/ui/web3/format"

/** USDG base units (6 dec) → "1,234.56 USDG". */
export const usdg = (v: bigint, digits = 2) => `${formatTokenAmount(v, 6, { maxFractionDigits: digits, minFractionDigits: digits })} USDG`

/** An 18-decimal USD value → "$181.23" (truncated, never rounded up). */
export const usd18 = (v: bigint, digits = 2) => `$${formatTokenAmount(v, 18, { maxFractionDigits: digits, minFractionDigits: digits })}`

/** A liquidator price: USDG (6 dec) per whole wrapper share → "181.23 USDG/share". */
export const perShare = (v: bigint) => `${formatTokenAmount(v, 6, { maxFractionDigits: 2, minFractionDigits: 2 })} USDG/share`

/** Token amounts with 18 decimals → "1.2345 NVDAx". */
export const tokens18 = (v: bigint, symbol: string, digits = 4) => `${formatTokenAmount(v, 18, { maxFractionDigits: digits })} ${symbol}`

/** Basis points → "3.00%". */
export const pctBps = (bps: bigint | number, digits = 2) => `${(Number(bps) / 100).toFixed(digits)}%`

/** Basis points → "300 bps". */
export const bpsText = (bps: bigint | number) => `${Number(bps).toLocaleString("en-US")} bps`

/** A 1e18-scaled multiplier → "1.0000×". */
export const multiplier = (v: bigint) => `${formatTokenAmount(v, 18, { maxFractionDigits: 4, minFractionDigits: 4 })}×`

/** Chainlink USDG/USD (8 dec) → "$1.0001". */
export const usdgUsd = (answer: bigint) => `$${formatTokenAmount(answer, 8, { maxFractionDigits: 4, minFractionDigits: 4 })}`

/** Seconds → "45 s", "12 min", "3 h 5 min", "2 d 4 h". */
export function duration(seconds: number | bigint): string {
  const s = Math.max(0, Math.floor(Number(seconds)))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`
}

/** "12 min ago" against chain time; "–" when either side is unknown. */
export function ago(unix: number | null | undefined, now: number | null | undefined): string {
  if (!unix || !now) return "–"
  if (unix > now) return `in ${duration(unix - now)}`
  return `${duration(now - unix)} ago`
}

/** "2026-09-25 14:03:21 UTC", or "–". */
export const utc = (unix: number | null | undefined) => (unix ? formatUtc(unix) : "–")

/** Just the clock part: "14:03:21". */
export const clock = (unix: number | null | undefined) => (unix ? formatUtc(unix).slice(11, 19) : "–")

/** Just the date: "2026-09-25". */
export const day = (unix: number | null | undefined) => (unix ? formatUtc(unix).slice(0, 10) : "–")

/** Block number with thousands separators: "#71,559,900". */
export const blockNo = (b: bigint | number) => `#${Number(b).toLocaleString("en-US")}`

/** Value × fraction for a fraction in [0, 1]: "42.1%". */
export const pctFraction = (f: number | null, digits = 1) => (f === null || !Number.isFinite(f) ? "–" : `${(f * 100).toFixed(digits)}%`)

/** |a − b| / b in bps, rounded up like the relay does. */
export function diffBps(a: bigint, ref: bigint): bigint {
  if (ref === 0n) return 0n
  const d = a > ref ? a - ref : ref - a
  return (d * 10_000n + ref - 1n) / ref
}
