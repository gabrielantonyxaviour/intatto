"use client"

/** Reads the lend screen needs beyond MarketLens: the rate model's parameters and the deficit history. */
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { interestRateModelAbi, lendingVaultAbi } from "@intatto/config/abi"
import { useIntatto } from "@/lib/chain"

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

/** The kinked model's parameters, read from the deployed InterestRateModel. */
export function useRateModel() {
  const { deployment, publicClient, chainId } = useIntatto()
  const address = deployment?.interestRateModel as Address | undefined
  return useQuery({
    queryKey: ["lend:rate-model", chainId, address],
    enabled: Boolean(address),
    staleTime: 60_000,
    queryFn: async (): Promise<RateModel> => {
      const read = (functionName: "baseBps" | "slope1Bps" | "slope2Bps" | "kinkBps") =>
        publicClient.readContract({ address: address!, abi: interestRateModelAbi, functionName }) as Promise<bigint>
      const [baseBps, slope1Bps, slope2Bps, kinkBps] = await Promise.all([
        read("baseBps"),
        read("slope1Bps"),
        read("slope2Bps"),
        read("kinkBps"),
      ])
      return { baseBps, slope1Bps, slope2Bps, kinkBps }
    },
  })
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

/** Supply rate (bps) after the reserve factor, the way InterestRateModel.supplyRateBps computes it. */
export function supplyRateAt(m: RateModel, u: bigint, reserveFactorBps = 2_000n): bigint {
  const x = u > 10_000n ? 10_000n : u
  return (((borrowRateAt(m, x) * x) / 10_000n) * (10_000n - reserveFactorBps)) / 10_000n
}
