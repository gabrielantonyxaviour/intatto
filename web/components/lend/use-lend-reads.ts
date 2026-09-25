"use client"

/** Reads the lend screen needs beyond MarketLens: every deployed market, the rate model and the deficit history. */
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { collateralMarketAbi, lendingVaultAbi, marketLensAbi, priceRelayAdapterAbi } from "@intatto/config/abi"
import { useIntatto, useMarketState, type MarketState, type MarketSymbol } from "@/lib/chain"

export type LendMarket = { symbol: MarketSymbol; state: MarketState }

/** MarketLens.market for every market in the active deployment. SPYx is skipped when it is not deployed. */
export function useLendMarkets() {
  const { deployment } = useIntatto()
  const nvda = useMarketState("NVDAx")
  const spy = useMarketState("SPYx")
  const bySymbol = { NVDAx: nvda, SPYx: spy }
  const rows = (deployment?.markets ?? []).map((market) => ({ market, query: bySymbol[market.symbol] }))
  const data: LendMarket[] | null = rows.every((r) => r.query.data)
    ? rows.map((r) => ({ symbol: r.market.symbol, state: r.query.data! }))
    : null
  return {
    data,
    error: rows.find((r) => r.query.isError)?.query.error ?? null,
    refetch: () => {
      for (const r of rows) void r.query.refetch()
    },
  }
}

export type RateModel = { baseBps: bigint; slope1Bps: bigint; slope2Bps: bigint; kinkBps: bigint }

export type DeficitRow = {
  index: number
  at: number
  market: Address
  borrower: Address
  amount: bigint
  sharePriceBefore: bigint
  sharePriceAfter: bigint
}

/** Newest first. Reads at most the latest `limit` records (LendingVault.deficitAt). */
export function useDeficits(count: bigint | undefined, limit = 50) {
  const { deployment, publicClient, chainId } = useIntatto()
  const vault = deployment?.vault as Address | undefined
  return useQuery({
    queryKey: ["lend:deficits", chainId, vault, count?.toString()],
    enabled: Boolean(vault) && count !== undefined,
    queryFn: async (): Promise<DeficitRow[]> => {
      const n = Number(count ?? 0n)
      const first = Math.max(0, n - limit)
      const indexes = Array.from({ length: n - first }, (_, k) => n - 1 - k)
      return Promise.all(
        indexes.map(async (i) => {
          const r = (await publicClient.readContract({
            address: vault!,
            abi: lendingVaultAbi,
            functionName: "deficitAt",
            args: [BigInt(i)],
          })) as {
            at: bigint | number
            market: Address
            borrower: Address
            amount: bigint
            sharePriceBefore: bigint
            sharePriceAfter: bigint
          }
          return { index: i, ...r, at: Number(r.at) }
        }),
      )
    },
  })
}

/** Borrow rate (bps) at `u` bps utilisation, the way InterestRateModel.borrowRateBps computes it. */
export function borrowRateAt(m: RateModel, u: bigint): bigint {
  const x = u > 10_000n ? 10_000n : u
  if (x <= m.kinkBps) return m.baseBps + (m.slope1Bps * x) / m.kinkBps
  return m.baseBps + m.slope1Bps + (m.slope2Bps * (x - m.kinkBps)) / (10_000n - m.kinkBps)
}

/** Supply rate (bps) after the reserve factor read from the market, the way InterestRateModel.supplyRateBps computes it. */
export function supplyRateAt(m: RateModel, u: bigint, reserveFactorBps: bigint): bigint {
  const x = u > 10_000n ? 10_000n : u
  return (((borrowRateAt(m, x) * x) / 10_000n) * (10_000n - reserveFactorBps)) / 10_000n
}

/** Vault owner() and the first market relay's keeper(), both at `blockNumber`. Disabled until that block is known. */
export function useRoleAddresses(blockNumber: bigint | undefined) {
  const { deployment, publicClient, chainId } = useIntatto()
  const vault = deployment?.vault
  const relay = deployment?.markets[0]?.priceRelay
  return useQuery({
    queryKey: ["lend:roles", chainId, vault, relay, blockNumber?.toString()],
    enabled: Boolean(vault && relay && blockNumber !== undefined),
    staleTime: 60_000,
    queryFn: async () => {
      const block = blockNumber!
      const [owner, keeper] = await Promise.all([
        publicClient.readContract({ address: vault as Address, abi: lendingVaultAbi, functionName: "owner", blockNumber: block }),
        publicClient.readContract({ address: relay as Address, abi: priceRelayAdapterAbi, functionName: "keeper", blockNumber: block }),
      ])
      return { owner: owner as Address, keeper: keeper as Address }
    },
  })
}

export type PinnedRiskFigures = {
  debt: bigint
  collateral: bigint
  reserveBalance: bigint
  totalAssets: bigint
  thresholds: { symbol: string; bps: bigint }[]
  /** Present only when SPYx is deployed. Read at the same block as the other figures. */
  spyReserveFactorBps: bigint | null
}

/**
 * MarketLens market/vault figures for the risk sheet, all at `blockNumber`.
 * Same lens calls as the live market and vault hooks. Disabled until the block is known.
 */
export function usePinnedRiskFigures(blockNumber: bigint | undefined) {
  const { deployment, publicClient, chainId } = useIntatto()
  const markets = deployment?.markets ?? []
  const vaultMarket = markets.find((m) => m.symbol === "NVDAx") ?? markets[0]
  return useQuery({
    queryKey: ["lend:risk-pinned", chainId, deployment?.lens, blockNumber?.toString(), markets.map((m) => m.market).join()],
    enabled: Boolean(deployment && vaultMarket && blockNumber !== undefined),
    staleTime: 60_000,
    queryFn: async (): Promise<PinnedRiskFigures> => {
      const block = blockNumber!
      const lens = deployment!.lens as Address
      const rows = await Promise.all(
        markets.map(async (m) => {
          const raw = (await publicClient.readContract({
            address: lens,
            abi: marketLensAbi,
            functionName: "market",
            args: [m.market as Address],
            blockNumber: block,
          })) as { totalDebt: bigint; totalCollateralValue: bigint; liquidationThresholdBps: bigint }
          return { symbol: m.symbol, debt: raw.totalDebt, collateral: raw.totalCollateralValue, bps: raw.liquidationThresholdBps }
        }),
      )
      const vaultRaw = (await publicClient.readContract({
        address: lens,
        abi: marketLensAbi,
        functionName: "vault",
        args: [vaultMarket!.market as Address],
        blockNumber: block,
      })) as { reserveBalance: bigint; totalAssets: bigint }
      const spy = markets.find((m) => m.symbol === "SPYx")
      const spyReserveFactorBps = spy
        ? ((await publicClient.readContract({
            address: spy.market as Address,
            abi: collateralMarketAbi,
            functionName: "RESERVE_FACTOR_BPS",
            blockNumber: block,
          })) as bigint)
        : null
      return {
        debt: rows.reduce((sum, row) => sum + row.debt, 0n),
        collateral: rows.reduce((sum, row) => sum + row.collateral, 0n),
        reserveBalance: vaultRaw.reserveBalance,
        totalAssets: vaultRaw.totalAssets,
        thresholds: rows.map((row) => ({ symbol: row.symbol, bps: row.bps })),
        spyReserveFactorBps,
      }
    },
  })
}
