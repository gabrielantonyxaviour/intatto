"use client"

/** Current state of every borrower found in the scanned Borrowed events, read through MarketLens at one block. */
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { marketLensAbi } from "@intatto/config/abi"
import type { MarketDeployment } from "@intatto/config/deployments"
import { useIntatto } from "@/lib/chain"

export type Loan = {
  borrower: Address
  shares: bigint
  /** Underlying tokens (18 dec) the wrapper shares redeem for. */
  assets: bigint
  valueUsdg: bigint
  debt: bigint
  ltvBps: bigint
  maxLtvBps: bigint
  healthFactorE18: bigint
  /** USD per underlying token (18 dec) at which debt = value × liquidation threshold. */
  liquidationPriceE18: bigint
  liquidatable: boolean
}

export type LoansSnapshot = { block: bigint; loans: Loan[] }

const CONCURRENCY = 6

export function useLoans(market: MarketDeployment | null, borrowers: Address[]) {
  const { deployment, publicClient, chainId } = useIntatto()
  const key = [...borrowers].map((b) => b.toLowerCase()).sort()
  return useQuery({
    queryKey: ["risk-loans", chainId, market?.market ?? null, key.join(",")],
    enabled: Boolean(deployment && market),
    refetchInterval: 30_000,
    queryFn: async (): Promise<LoansSnapshot> => {
      const block = await publicClient.getBlockNumber({ cacheTime: 0 })
      const out: Loan[] = []
      for (let i = 0; i < key.length; i += CONCURRENCY) {
        const batch = key.slice(i, i + CONCURRENCY) as Address[]
        const rows = await Promise.all(
          batch.map((user) =>
            publicClient.readContract({
              address: deployment!.lens as Address,
              abi: marketLensAbi,
              functionName: "account",
              args: [market!.market as Address, user],
              blockNumber: block,
            }),
          ),
        )
        rows.forEach((a, j) =>
          out.push({
            borrower: batch[j]!,
            shares: a.shares,
            assets: a.assets,
            valueUsdg: a.valueUsdg,
            debt: a.debt,
            ltvBps: a.ltvBps,
            maxLtvBps: a.maxLtvBps,
            healthFactorE18: a.healthFactorE18,
            liquidationPriceE18: a.liquidationPriceE18,
            liquidatable: a.liquidatable,
          }),
        )
      }
      return { block, loans: out }
    },
  })
}

/** LTV points left before the liquidation threshold (negative once past it). */
export function distanceBps(loan: Loan, thresholdBps: bigint): bigint {
  return thresholdBps - loan.ltvBps
}

/** Fraction the price can fall before liquidation: 1 − liquidation price / price. */
export function dropToLiquidation(loan: Loan, priceE18: bigint): number | null {
  if (loan.debt === 0n || priceE18 === 0n) return null
  return 1 - Number((loan.liquidationPriceE18 * 1_000_000n) / priceE18) / 1_000_000
}

/** Collateral value after the price moves by `-shock` (0.2 = 20% lower), in USDG base units. */
export function shockedValue(loan: Loan, shock: number): bigint {
  const keep = BigInt(Math.round((1 - shock) * 1_000_000))
  return (loan.valueUsdg * keep) / 1_000_000n
}

/** True when the loan would be past the liquidation threshold after the shock (the market's own test). */
export function liquidatableAfter(loan: Loan, shock: number, thresholdBps: bigint): boolean {
  if (loan.debt === 0n) return false
  const value = shockedValue(loan, shock)
  return loan.debt * 10_000n > value * thresholdBps
}
