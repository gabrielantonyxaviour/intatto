/**
 * What a draft on the borrow screen would do: amounts, the position before → after, and the refusal the contract
 * would give, checked client-side in CollateralMarket.borrow's own order before anything is simulated or signed.
 */
import { REFUSALS, type RefusalName } from "@intatto/config/session"
import type { AccountState, MarketState, VaultState } from "@/lib/chain"
import { parseAmount } from "@/components/ui/web3/format"
import { nvdax, usdg } from "./format"
import {
  ACK_LTV_BPS,
  CHIP_TARGETS,
  assetsToShares,
  borrowLimits,
  chipAmount,
  maxWithdrawShares,
  metrics,
  min,
  sharesToAssets,
  valueOf,
  type BorrowLimits,
  type Metrics,
} from "./math"

const MAX_UINT = 2n ** 256n - 1n
/** A typed repay within one cent of the debt, with a wallet that covers it, repays everything. */
const DUST = 10_000n

export type Refusal = { name: RefusalName; label: string; reason: string }

const refused = (name: RefusalName, label = `Refused: ${name}`): Refusal => ({ name, label, reason: REFUSALS[name] })

export function currentMetrics(a: AccountState | null): Metrics {
  if (!a) return { shares: 0n, assets: 0n, debt: 0n, valueUsdg: 0n, ltvBps: 0n, healthE18: MAX_UINT, liquidationPriceE18: 0n }
  return {
    shares: a.shares,
    assets: a.assets,
    debt: a.debt,
    valueUsdg: a.valueUsdg,
    ltvBps: a.ltvBps,
    healthE18: a.healthFactorE18,
    liquidationPriceE18: a.liquidationPriceE18,
  }
}

export type Chip = { level: string; ltvBps: bigint; amount: bigint; overLimit: boolean }

export type BorrowPlan = {
  deposit: bigint
  depositShares: bigint
  loan: bigint
  before: Metrics
  after: Metrics
  limits: BorrowLimits
  chips: Chip[]
  balanceError: string | null
  refusal: Refusal | null
  loanError: string | null
  needsAck: boolean
  empty: boolean
}

/** Client pre-check, in the order CollateralMarket.borrow checks (issuer, session, limit, guards, cap, peg, liquidity). */
export function borrowPrecheck(m: MarketState, limits: BorrowLimits, loan: bigint): Refusal | null {
  if (loan === 0n) return null
  if (m.issuerPaused) return refused("IssuerPaused")
  if (m.session === "UNKNOWN") return refused("UnknownSession")
  if (loan > limits.session) {
    return refused(
      "SessionLimit",
      m.maxLtvBps === 0n
        ? `New borrowing is off in the ${m.session} session`
        : `Maximum borrowable exceeded for the ${m.session} session`,
    )
  }
  if (!m.fresh) return refused("StalePrice")
  if (!m.inBand) return refused("PriceOutOfBand")
  if (m.corporateActionPaused) return refused("CorporateActionPending")
  if (loan > limits.cap) return refused("TickerCapReached", "Above this stock's debt cap")
  if (!m.pegOk) return refused("UsdgOffPeg")
  if (loan > limits.idle) return refused("InsufficientLiquidity", "More than the vault can lend right now")
  return null
}

export function borrowPlan(
  m: MarketState,
  v: VaultState,
  a: AccountState | null,
  draft: { collateral: string; loan: string },
): BorrowPlan {
  const deposit = parseAmount(draft.collateral, 18) ?? 0n
  const loan = parseAmount(draft.loan, 6) ?? 0n
  const before = currentMetrics(a)
  const depositShares = assetsToShares(deposit, m.assetsPerShare)
  const valueWithDeposit = deposit === 0n ? before.valueUsdg : valueOf(before.assets + deposit, m.priceE18)
  const after =
    deposit === 0n && loan === 0n
      ? before
      : metrics(
          { shares: before.shares + depositShares, assets: before.assets + deposit, debt: before.debt + loan },
          m.priceE18,
          m.liquidationThresholdBps,
        )
  const limits = borrowLimits({
    valueUsdg: valueWithDeposit,
    debt: before.debt,
    maxLtvBps: m.maxLtvBps,
    capUsdg: m.capUsdg,
    totalDebt: m.totalDebt,
    idle: v.idle,
    borrowRateBps: v.borrowRateBps,
  })
  const chips = CHIP_TARGETS.map((t) => {
    const amount = chipAmount(valueWithDeposit, before.debt, t.ltvBps)
    return { level: t.level, ltvBps: t.ltvBps, amount, overLimit: amount > limits.max }
  })
  const balanceError = a && deposit > a.walletToken ? "Insufficient NVDAx balance" : null
  const refusal = borrowPrecheck(m, limits, loan)
  const amountRefusal = refusal && ["SessionLimit", "TickerCapReached", "InsufficientLiquidity"].includes(refusal.name)
  return {
    deposit,
    depositShares,
    loan,
    before,
    after,
    limits,
    chips,
    balanceError,
    refusal,
    loanError: amountRefusal ? `${refusal.label}. You can borrow up to ${usdg(limits.max)} now.` : null,
    needsAck: loan > 0n && !refusal && after.ltvBps > ACK_LTV_BPS,
    empty: deposit === 0n && loan === 0n,
  }
}

export type RepayPlan = {
  repay: bigint
  /** Argument for repay(): max uint when repaying everything, so interest accrued meanwhile is covered. */
  repayArg: bigint
  /** What the approval must cover. */
  repayApprove: bigint
  repayAll: boolean
  repayMax: bigint
  walletShort: boolean
  withdrawShares: bigint
  withdrawAssets: bigint
  maxShares: bigint
  maxAssets: bigint
  before: Metrics
  after: Metrics
  repayError: string | null
  withdrawError: string | null
  refusal: Refusal | null
  empty: boolean
}

export function repayPlan(
  m: MarketState,
  v: VaultState,
  a: AccountState | null,
  draft: { repay: string; withdraw: string; all: boolean },
): RepayPlan {
  const before = currentMetrics(a)
  const wallet = a?.walletUsdg ?? 0n
  const repay = parseAmount(draft.repay, 6) ?? 0n
  const repayMax = min(wallet, before.debt)
  // "Repay everything" when Max was picked (or the typed amount is within a cent of the debt) and the wallet covers it.
  const repayAll = repay > 0n && before.debt > 0n && wallet >= before.debt && (draft.all || repay + DUST >= before.debt)
  const paid = repayAll ? before.debt : min(repay, before.debt)
  const debtAfter = before.debt - paid
  const aps = m.assetsPerShare
  const maxShares = maxWithdrawShares({
    shares: before.shares,
    debtAfter,
    maxLtvBps: m.maxLtvBps,
    priceE18: m.priceE18,
    assetsPerShare: aps,
    borrowRateBps: v.borrowRateBps,
  })
  const maxAssets = maxShares === before.shares ? before.assets : sharesToAssets(maxShares, aps)
  const typed = parseAmount(draft.withdraw, 18) ?? 0n
  const withdrawShares = typed === 0n ? 0n : typed === maxAssets ? maxShares : assetsToShares(typed, aps)
  const sharesAfter = before.shares > withdrawShares ? before.shares - withdrawShares : 0n
  const assetsAfter =
    withdrawShares === 0n ? before.assets : sharesAfter === 0n || typed >= before.assets ? 0n : before.assets - typed
  const after =
    repay === 0n && withdrawShares === 0n
      ? before
      : metrics({ shares: sharesAfter, assets: assetsAfter, debt: debtAfter }, m.priceE18, m.liquidationThresholdBps)

  let repayError: string | null = null
  if (repay > 0n && before.debt === 0n) repayError = "Nothing to repay"
  else if (repay > wallet) repayError = "Insufficient USDG balance"
  else if (repay > before.debt + DUST && !repayAll) repayError = "More than you owe"

  let withdrawError: string | null = null
  let refusal: Refusal | null = null
  if (withdrawShares > before.shares) withdrawError = "More than your collateral"
  else if (withdrawShares > 0n && debtAfter > 0n && !m.fresh) refusal = refused("StalePrice")
  else if (withdrawShares > maxShares) {
    refusal = refused("Unhealthy", `Withdrawal exceeds the ${m.session} session limit`)
    withdrawError = `${refusal.label}. You can withdraw up to ${nvdax(maxAssets)} while this debt is open.`
  }

  return {
    repay,
    repayArg: repayAll ? MAX_UINT : repay,
    repayApprove: repayAll ? min(wallet, before.debt + before.debt / 1000n + DUST) : repay,
    repayAll,
    repayMax,
    walletShort: before.debt > 0n && wallet < before.debt,
    withdrawShares,
    withdrawAssets: typed,
    maxShares,
    maxAssets,
    before,
    after,
    repayError,
    withdrawError,
    refusal,
    empty: repay === 0n && typed === 0n,
  }
}
