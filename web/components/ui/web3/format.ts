import { formatUnits, parseUnits } from "viem"

/** 0x1234…abcd */
export function shortAddress(value: string, chars = 4): string {
  if (value.length <= 2 + chars * 2 + 1) return value
  return `${value.slice(0, 2 + chars)}…${value.slice(-chars)}`
}

function groupThousands(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * Formats a token amount from its bigint base units without going through a float, so 18-decimal
 * values keep every digit that is shown. The fraction is truncated (never rounded up).
 */
export function formatTokenAmount(
  value: bigint,
  decimals: number,
  { maxFractionDigits = 4, minFractionDigits = 0 }: { maxFractionDigits?: number; minFractionDigits?: number } = {},
): string {
  const negative = value < 0n
  const [integer = "0", fraction = ""] = formatUnits(negative ? -value : value, decimals).split(".")
  let frac = fraction.slice(0, maxFractionDigits).replace(/0+$/, "")
  if (frac.length < minFractionDigits) frac = frac.padEnd(minFractionDigits, "0")
  const truncatedToZero = value !== 0n && integer === "0" && frac.replace(/0/g, "") === ""
  if (truncatedToZero) {
    const smallest = maxFractionDigits > 0 ? `0.${"0".repeat(maxFractionDigits - 1)}1` : "1"
    return `${negative ? ">-" : "<"}${smallest}`
  }
  return `${negative ? "-" : ""}${groupThousands(integer)}${frac ? `.${frac}` : ""}`
}

/**
 * Parses a user-typed decimal string into base units. Returns null for "", ".", or anything that
 * is not a plain non-negative decimal with at most `decimals` fraction digits.
 */
export function parseAmount(value: string, decimals: number): bigint | null {
  const v = value.trim()
  if (!v || v === ".") return null
  if (!/^\d*\.?\d*$/.test(v)) return null
  const [, fraction = ""] = v.split(".")
  if (fraction.length > decimals) return null
  try {
    return parseUnits(v.endsWith(".") ? v.slice(0, -1) : v, decimals)
  } catch {
    return null
  }
}

/** A fraction (0.5) as a percentage string ("50.00%"). */
export function formatPercent(fraction: number, digits = 2): string {
  if (!Number.isFinite(fraction)) return "–"
  return `${(fraction * 100).toFixed(digits)}%`
}

/** 2026-09-25 14:03:21 UTC */
export function formatUtc(unixSeconds: number | bigint): string {
  const d = new Date(Number(unixSeconds) * 1000)
  if (Number.isNaN(d.getTime())) return "–"
  return `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

export function formatNumber(value: number | bigint): string {
  return typeof value === "bigint" ? groupThousands(value.toString()) : numberFormat.format(value)
}
