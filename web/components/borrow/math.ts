/**
 * Position math for the borrow screen, in the contracts' own units and rounding (bigint only):
 * USDG 6 decimals, NVDAx and wNVDAx 18 decimals, prices 18 decimals, ratios in bps.
 * Mirrors CollateralMarketBase.valueOf/_ltvBps and MarketLens.account so previews match what the chain reports.
 */

export const E18 = 10n ** 18n
const E30 = 10n ** 30n
const BPS = 10_000n
const MAX_UINT = 2n ** 256n - 1n
const YEAR = 31_536_000n

/** LTV at which the risk label turns Medium / High (fractions). High is also where the acknowledgement starts. */
export const RISK_LEVELS = { medium: 0.3, high: 0.45 } as const
/** Loans above this LTV need an explicit acknowledgement before the review. */
export const ACK_LTV_BPS = 4500n
/** Preset loan chips: target LTV after the loan, one per risk level. */
export const CHIP_TARGETS = [
  { level: "Low", ltvBps: 2000n },
  { level: "Medium", ltvBps: 3500n },
  { level: "High", ltvBps: 4800n },
] as const
/** Monday-open gaps the position panel stresses, in percent. */
export const GAP_STEPS = [5, 10, 20, 30] as const

export type Position = { shares: bigint; assets: bigint; debt: bigint }

export type Metrics = Position & {
  valueUsdg: bigint
  /** Floor bps like MarketLens (0 with no debt). */
  ltvBps: bigint
  /** 1e18-scaled; max uint with no debt, like MarketLens. */
  healthE18: bigint
  /** USD per NVDAx, 18 decimals; 0 when there is no collateral. */
  liquidationPriceE18: bigint
}

export const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a))
const ceilDiv = (a: bigint, b: bigint) => (a === 0n ? 0n : (a - 1n) / b + 1n)
const clampZero = (x: bigint) => (x < 0n ? 0n : x)

/** USDG value (6 dec) of `assets` NVDAx at the relayed price: assets × price / 1e30. */
export function valueOf(assets: bigint, priceE18: bigint): bigint {
  return (assets * priceE18) / E30
}

export function sharesToAssets(shares: bigint, assetsPerShare: bigint): bigint {
  return (shares * assetsPerShare) / E18
}

export function assetsToShares(assets: bigint, assetsPerShare: bigint): bigint {
  return assetsPerShare === 0n ? 0n : (assets * E18) / assetsPerShare
}

export function ltvBpsOf(debt: bigint, value: bigint): bigint {
  if (debt === 0n) return 0n
  return value === 0n ? MAX_UINT : (debt * BPS) / value
}

export function metrics(p: Position, priceE18: bigint, ltBps: bigint): Metrics {
  const valueUsdg = valueOf(p.assets, priceE18)
  return {
    ...p,
    valueUsdg,
    ltvBps: ltvBpsOf(p.debt, valueUsdg),
    healthE18: p.debt === 0n ? MAX_UINT : (valueUsdg * ltBps * E18) / (p.debt * BPS),
    liquidationPriceE18: p.assets === 0n ? 0n : (p.debt * E30 * BPS) / (p.assets * ltBps),
  }
}

export const noDebt = (m: Pick<Metrics, "debt">) => m.debt === 0n
export const isMaxUint = (x: bigint) => x === MAX_UINT

export type BorrowLimits = {
  /** What the session limit leaves for new debt, minus a small accrual margin. */
  session: bigint
  cap: bigint
  idle: bigint
  /** min of the three: the Max button's value. */
  max: bigint
  binding: "session" | "cap" | "idle"
}

/**
 * Borrowing room on a position valued `valueUsdg` with `debt` owed. The margin (1 cent plus five minutes of
 * interest) keeps Max below the contract's ceil-rounded check while interest accrues before the tx lands.
 */
export function borrowLimits(args: {
  valueUsdg: bigint
  debt: bigint
  maxLtvBps: bigint
  capUsdg: bigint
  totalDebt: bigint
  idle: bigint
  borrowRateBps: bigint
}): BorrowLimits {
  const margin = 10_000n + (args.debt * args.borrowRateBps * 300n) / (BPS * YEAR)
  const session = clampZero((args.valueUsdg * args.maxLtvBps) / BPS - args.debt - margin)
  const cap = clampZero(args.capUsdg - args.totalDebt)
  const idle = args.idle
  const max = min(session, cap, idle)
  const binding = max === session ? "session" : max === cap ? "cap" : "idle"
  return { session, cap, idle, max, binding }
}

/** Preset loan amount that takes the position to `targetBps` LTV; rounded down to whole USDG above 10 USDG. */
export function chipAmount(valueUsdg: bigint, debt: bigint, targetBps: bigint): bigint {
  const raw = clampZero((valueUsdg * targetBps) / BPS - debt)
  const unit = raw >= 10_000_000n ? 1_000_000n : 10_000n
  return (raw / unit) * unit
}

/**
 * Wrapper shares that can leave while the position stays within the session limit (CollateralMarket.withdrawCollateral:
 * with debt, ceil(debt × 1e4 / value) must not exceed maxLtvBps). Everything when there is no debt.
 */
export function maxWithdrawShares(args: {
  shares: bigint
  debtAfter: bigint
  maxLtvBps: bigint
  priceE18: bigint
  assetsPerShare: bigint
  borrowRateBps: bigint
}): bigint {
  const { shares, debtAfter, maxLtvBps, priceE18, assetsPerShare } = args
  if (debtAfter === 0n) return shares
  if (maxLtvBps === 0n || priceE18 === 0n || assetsPerShare === 0n) return 0n
  const padded = debtAfter + 10_000n + (debtAfter * args.borrowRateBps * 300n) / (BPS * YEAR)
  const requiredValue = ceilDiv(padded * BPS, maxLtvBps)
  const requiredAssets = ceilDiv(requiredValue * E30, priceE18)
  const requiredShares = ceilDiv(requiredAssets * E18, assetsPerShare) + 1n
  return clampZero(shares - requiredShares)
}

export type GapRow = {
  dropPct: number
  priceE18: bigint
  ltvBps: bigint
  healthE18: bigint
  liquidatable: boolean
}

/** Health and LTV if the stock reopens `dropPct` lower (same test as CollateralMarketBase.isLiquidatable). */
export function gapRows(m: Metrics, priceE18: bigint, ltBps: bigint): GapRow[] {
  return GAP_STEPS.map((dropPct) => {
    const keep = BigInt(100 - dropPct)
    const value = (m.valueUsdg * keep) / 100n
    return {
      dropPct,
      priceE18: (priceE18 * keep) / 100n,
      ltvBps: ltvBpsOf(m.debt, value),
      healthE18: m.debt === 0n ? MAX_UINT : (value * ltBps * E18) / (m.debt * BPS),
      liquidatable: m.debt > 0n && m.debt * BPS > value * ltBps,
    }
  })
}

/** How far the price can fall before the position is liquidatable, as a fraction (null with no debt). */
export function dropToLiquidation(m: Metrics, ltBps: bigint): number | null {
  if (m.debt === 0n || m.valueUsdg === 0n) return null
  const reach = Number((m.debt * BPS * 1_000_000n) / (m.valueUsdg * ltBps)) / 1_000_000
  return Math.max(0, 1 - reach)
}

/** Yearly interest on `principal` at `rateBps` (simple, at today's rate). */
export function yearlyInterest(principal: bigint, rateBps: bigint): bigint {
  return (principal * rateBps) / BPS
}

export const bpsToFraction = (bps: bigint) => (isMaxUint(bps) ? Infinity : Number(bps) / 10_000)
