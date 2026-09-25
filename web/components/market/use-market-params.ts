"use client"

/** Live relay readings (TWAP, implied wrapper price, Chainlink answer). Parameter bounds come from useProtocolParams. */
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { priceRelayAdapterAbi } from "@intatto/config/abi"
import { useIntatto, useMarketDeployment, type MarketSymbol } from "@/lib/chain"

export type RelayDetail = {
  twapOk: boolean
  twapE18: bigint
  impliedE18: bigint
  usdgAnswerE8: bigint
  usdgUpdatedAt: number
  usdgOk: boolean
  bandOpenBps: bigint
  bandOtherBps: bigint
  maxMoveBps: bigint
  priceLivenessSeconds: bigint
  pegBps: bigint
}

/** The relay's live guard inputs for one market (TWAP, implied price, USDG answer). Bounds come from useProtocolParams. */
export function useRelayDetail(symbol: MarketSymbol) {
  const m = useMarketDeployment(symbol)
  const { publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["market-screen", "relay", chainId, m?.priceRelay],
    enabled: Boolean(m),
    refetchInterval: 12_000,
    queryFn: async (): Promise<RelayDetail> => {
      const r = { address: m!.priceRelay as Address, abi: priceRelayAdapterAbi } as const
      const [[twapOk, twap], implied, [answer, updatedAt, usdgOk], open, other, move, liveness, peg] = await Promise.all([
        publicClient.readContract({ ...r, functionName: "twapWrapperPrice" }),
        publicClient.readContract({ ...r, functionName: "impliedWrapperPrice" }),
        publicClient.readContract({ ...r, functionName: "usdgStatus" }),
        publicClient.readContract({ ...r, functionName: "bandOpenBps" }),
        publicClient.readContract({ ...r, functionName: "bandOtherBps" }),
        publicClient.readContract({ ...r, functionName: "maxMoveBps" }),
        publicClient.readContract({ ...r, functionName: "priceLiveness" }),
        publicClient.readContract({ ...r, functionName: "pegBps" }),
      ])
      return {
        twapOk,
        twapE18: twap,
        impliedE18: implied,
        usdgAnswerE8: answer,
        usdgUpdatedAt: Number(updatedAt),
        usdgOk,
        bandOpenBps: open,
        bandOtherBps: other,
        maxMoveBps: move,
        priceLivenessSeconds: liveness,
        pegBps: peg,
      }
    },
  })
}

/** Latest block time on the active chain (the fork's simulated clock in sandbox mode). */
export function useChainNow() {
  const { publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["intatto:latest-block", chainId],
    queryFn: () => publicClient.getBlock({ blockTag: "latest" }),
    refetchInterval: 5_000,
    retry: 1,
    select: (b) => Number(b.timestamp),
  })
}
