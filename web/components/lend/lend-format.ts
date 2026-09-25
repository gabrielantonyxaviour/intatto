import { formatTokenAmount } from "@/components/ui/web3/format"

/** USDG and the vault's iUSDG shares both use 6 decimals. */
export const USDG_DECIMALS = 6
export const SHARE_SYMBOL = "iUSDG"

/** "12,345.67 USDG" from 6-decimal base units. */
export function usdg(value: bigint, digits = 2): string {
  return `${formatTokenAmount(value, USDG_DECIMALS, { maxFractionDigits: digits, minFractionDigits: digits })} USDG`
}

/** USDG per whole iUSDG share, every digit the vault keeps: "1.000000". */
export function sharePriceNumber(value: bigint): string {
  return formatTokenAmount(value, USDG_DECIMALS, { maxFractionDigits: 6, minFractionDigits: 6 })
}

/** The share price with its unit: "1.000000 USDG". */
export function sharePriceText(value: bigint): string {
  return `${sharePriceNumber(value)} USDG`
}

/** Basis points as a percentage: 280n → "2.80%". */
export function bpsText(bps: bigint | number, digits = 2): string {
  return `${(Number(bps) / 100).toFixed(digits)}%`
}

/** a / b as a percentage string, "–" when b is zero. */
export function ratioText(a: bigint, b: bigint, digits = 2): string {
  if (b === 0n) return "–"
  return `${((Number(a) / Number(b)) * 100).toFixed(digits)}%`
}

/** Simple (non-compounding) interest on `amount` at `rateBps` a year, over `months` months. */
export function projectedEarnings(amount: bigint, rateBps: bigint, months: number): bigint {
  return (amount * rateBps * BigInt(months)) / (10_000n * 12n)
}

/** Share price change as a signed percentage: before 1.000000 → after 0.993000 is "-0.70%". */
export function changeText(before: bigint, after: bigint, digits = 4): string {
  if (before === 0n) return "–"
  const pct = ((Number(after) - Number(before)) / Number(before)) * 100
  return `${pct > 0 ? "+" : ""}${pct.toFixed(digits)}%`
}
