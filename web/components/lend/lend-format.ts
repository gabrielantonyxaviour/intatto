// Relative import (not "@/…") so the Playwright spec can import these same formatters from Node.
import { formatTokenAmount } from "../ui/web3/format.ts"

/** USDG and the vault's iUSDG shares both use 6 decimals. */
export const USDG_DECIMALS = 6
export const SHARE_SYMBOL = "iUSDG"

const TEN = 10_000_000n
const THOUSAND = 1_000_000_000n

/** Enough fraction digits for small amounts: at least 4 under 10, at least 2 under 1,000. */
function fractionDigits(value: bigint, digits: number): number {
  const abs = value < 0n ? -value : value
  if (abs < TEN) return Math.max(digits, 4)
  if (abs < THOUSAND) return Math.max(digits, 2)
  return digits
}

/** 6-decimal base units as a plain amount: "50,150", "150.5", "1.4975". */
export function amount6(value: bigint, digits = 2): string {
  return formatTokenAmount(value, USDG_DECIMALS, { maxFractionDigits: fractionDigits(value, digits), minFractionDigits: digits })
}

/** "12,345.67 USDG" from 6-decimal base units; amounts under 10 keep four decimals ("1.4975 USDG"). */
export function usdg(value: bigint, digits = 2): string {
  return `${amount6(value, digits)} USDG`
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

/**
 * What a write-off does to the share price at today's deposits, as one sentence. The example loss is
 * min(1,000 USDG, total assets), so the drop it states never exceeds 100%.
 */
export function lossExample(totalAssets: bigint): string {
  if (totalAssets <= 0n) return "The vault holds no deposits right now, so there is nothing to write off against."
  if (totalAssets <= THOUSAND) {
    return `The vault holds ${usdg(totalAssets)} today, so a write-off that size would wipe out all deposits.`
  }
  const milliPct = (THOUSAND * 100_000n) / totalAssets // percent × 1,000, truncated; below 100% here
  const text =
    milliPct === 0n ? "less than 0.001%" : `${milliPct / 1_000n}.${(milliPct % 1_000n).toString().padStart(3, "0")}%`
  return `Each 1,000 USDG written off lowers the share price by ${text} at today's deposits.`
}
