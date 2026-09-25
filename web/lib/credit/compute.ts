/**
 * The credit and health report for one wallet in one market, computed from onchain reads only:
 * MarketLens.account / market / vault, all pinned to the same block. Pure: no env, no fetch of its own.
 */
import { formatUnits, getAddress, type Address, type PublicClient } from "viem"
import { marketLensAbi } from "@intatto/config/abi"
import { sessionFromIndex, type RefusalName, type Session } from "@intatto/config/session"
import type { Deployment } from "@intatto/config/deployments"
import { XLAYER } from "@intatto/config/xlayer"
import { CreditError } from "./http"
import type { CreditMarket, CreditNetwork } from "./query"

export const PRICE_SOURCE = "keeper relay of the xStocks issuer's indicative quote (trusted relayer, bounded onchain)"
/** Sandbox keeper posts are the fork's pool-implied quote and calendar, not the issuer's live quote. */
export const SANDBOX_PRICE_SOURCE =
  "simulated pool-derived keeper post on this fork (not the issuer's live quote); a replay can override it"

export function priceSourceFor(network: CreditNetwork): string {
  return network === "sandbox" ? SANDBOX_PRICE_SOURCE : PRICE_SOURCE
}
const TOKEN_DECIMALS = 18 // xStock tokens and their ERC-4626 wrappers (the relay refuses anything else)
const USDG_DECIMALS = XLAYER.usdgDecimals
const MAX_UINT = 2n ** 256n - 1n

export type CreditReport = {
  service: "intatto-credit"
  version: "1"
  network: CreditNetwork
  chainId: number
  block: number
  wallet: Address
  market: CreditMarket
  session: { state: Session; maxNewBorrowLtvBps: number; periodChangedAt: string | null; postedAt: string | null }
  price: { usdPerToken: string | null; fetchedAt: string | null; sourceTimestamp: null; source: string }
  guards: { fresh: boolean; inBand: boolean; pegOk: boolean; corporateActionPaused: boolean; issuerPaused: boolean }
  position: {
    collateralTokens: string
    collateralWrapperShares: string
    valueUsdg: string
    debtUsdg: string
    ltvBps: number | null
    healthFactor: string | null
  }
  capacity: { borrowableNowUsdg: string; limitBps: number; reason?: RefusalName }
  liquidation: {
    thresholdBps: number
    liquidationPriceUsd: string | null
    gapToLiquidationBps: number | null
    liquidatableNow: boolean
  }
  asOf: string
}

/** What CollateralMarket.borrow checks, in its order, for the smallest possible borrow (1 USDG unit). */
export type BorrowState = {
  issuerPaused: boolean
  session: Session
  debt: bigint
  valueUsdg: bigint
  maxLtvBps: bigint
  fresh: boolean
  inBand: boolean
  corporateActionPaused: boolean
  totalDebt: bigint
  capUsdg: bigint
  pegOk: boolean
  idle: bigint
}

/** The custom error CollateralMarket.borrow(1) would revert with right now, or undefined when it would pass. */
export function borrowRefusal(s: BorrowState): RefusalName | undefined {
  const amount = 1n
  if (s.issuerPaused) return "IssuerPaused"
  if (s.session === "UNKNOWN") return "UnknownSession"
  const debtAfter = s.debt + amount
  // _ltvBps rounds up: ceil(debt * 10_000 / value); no collateral value means an infinite LTV.
  const ltv = s.valueUsdg === 0n ? MAX_UINT : (debtAfter * 10_000n + s.valueUsdg - 1n) / s.valueUsdg
  if (ltv > s.maxLtvBps) return "SessionLimit"
  if (!s.fresh) return "StalePrice"
  if (!s.inBand) return "PriceOutOfBand"
  if (s.corporateActionPaused) return "CorporateActionPending"
  if (s.totalDebt + amount > s.capUsdg) return "TickerCapReached"
  if (!s.pegOk) return "UsdgOffPeg"
  if (amount > s.idle) return "InsufficientLiquidity"
  return undefined
}

/** The fall in the token price, in bps of today's price, at which the position becomes liquidatable. */
export function gapToLiquidationBps(priceE18: bigint, liquidationPriceE18: bigint, debt: bigint, assets: bigint): number | null {
  if (debt === 0n || priceE18 === 0n) return null
  // Debt with no collateral is liquidatable at any price.
  if (assets === 0n || liquidationPriceE18 >= priceE18) return 0
  return Number(((priceE18 - liquidationPriceE18) * 10_000n) / priceE18)
}

const iso = (seconds: bigint): string | null => (seconds === 0n ? null : new Date(Number(seconds) * 1000).toISOString())
const bps = (v: bigint): number | null => (v === MAX_UINT ? null : Number(v))

export async function computeCredit(
  client: PublicClient,
  deployment: Deployment,
  wallet: Address,
  market: CreditMarket,
  opts: { network: CreditNetwork },
): Promise<CreditReport> {
  const m = deployment.markets.find((x) => x.symbol === market)
  if (!m) throw new CreditError(404, `${market} has no market in this Intatto deployment.`, "MARKET_NOT_LISTED")
  const lens = deployment.lens as Address
  const marketAddress = m.market as Address

  const [block, chainId] = await Promise.all([client.getBlock({ blockTag: "latest" }), client.getChainId()])
  if (opts.network === "mainnet" && chainId !== deployment.chainId) {
    throw new CreditError(503, "The RPC answered for a different chain than the deployment.", "CHAIN_MISMATCH")
  }
  const blockNumber = block.number
  const [a, k, v] = await Promise.all([
    client.readContract({ address: lens, abi: marketLensAbi, functionName: "account", args: [marketAddress, wallet], blockNumber }),
    client.readContract({ address: lens, abi: marketLensAbi, functionName: "market", args: [marketAddress], blockNumber }),
    client.readContract({ address: lens, abi: marketLensAbi, functionName: "vault", args: [marketAddress], blockNumber }),
  ])

  const session = sessionFromIndex(Number(k.session))
  const reason = borrowRefusal({
    issuerPaused: k.issuerPaused,
    session,
    debt: a.debt,
    valueUsdg: a.valueUsdg,
    maxLtvBps: k.maxLtvBps,
    fresh: k.fresh,
    inBand: k.inBand,
    corporateActionPaused: k.corporateActionPaused,
    totalDebt: k.totalDebt,
    capUsdg: k.capUsdg,
    pegOk: k.pegOk,
    idle: v.idle,
  })
  const borrowable = reason ? 0n : a.borrowCapacity
  const hasDebt = a.debt > 0n

  return {
    service: "intatto-credit",
    version: "1",
    network: opts.network,
    chainId,
    block: Number(blockNumber),
    wallet: getAddress(wallet),
    market,
    session: {
      state: session,
      maxNewBorrowLtvBps: Number(k.maxLtvBps),
      periodChangedAt: iso(k.periodChangedAt),
      postedAt: iso(k.sessionPostedAt),
    },
    price: {
      usdPerToken: k.priceE18 === 0n ? null : formatUnits(k.priceE18, 18),
      fetchedAt: iso(k.fetchedAt),
      sourceTimestamp: null,
      source: priceSourceFor(opts.network),
    },
    guards: {
      fresh: k.fresh,
      inBand: k.inBand,
      pegOk: k.pegOk,
      corporateActionPaused: k.corporateActionPaused,
      issuerPaused: k.issuerPaused,
    },
    position: {
      collateralTokens: formatUnits(a.assets, TOKEN_DECIMALS),
      collateralWrapperShares: formatUnits(a.shares, TOKEN_DECIMALS),
      valueUsdg: formatUnits(a.valueUsdg, USDG_DECIMALS),
      debtUsdg: formatUnits(a.debt, USDG_DECIMALS),
      ltvBps: bps(a.ltvBps),
      healthFactor: a.healthFactorE18 === MAX_UINT ? null : formatUnits(a.healthFactorE18, 18),
    },
    capacity: {
      borrowableNowUsdg: formatUnits(borrowable, USDG_DECIMALS),
      limitBps: Number(k.maxLtvBps),
      ...(reason ? { reason } : {}),
    },
    liquidation: {
      thresholdBps: Number(k.liquidationThresholdBps),
      liquidationPriceUsd: hasDebt && a.assets > 0n ? formatUnits(a.liquidationPriceE18, 18) : null,
      gapToLiquidationBps: gapToLiquidationBps(k.priceE18, a.liquidationPriceE18, a.debt, a.assets),
      liquidatableNow: a.liquidatable,
    },
    asOf: new Date(Number(block.timestamp) * 1000).toISOString(),
  }
}
