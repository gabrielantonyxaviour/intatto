"use client"

/**
 * Reads the Market screen needs beyond MarketLens: the session limits, the liquidator's slice rules and each
 * relay's guard inputs (pool TWAP, implied wrapper price, Chainlink USDG/USD, band widths).
 */
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { boundedLiquidatorAbi, priceRelayAdapterAbi, sessionRiskControllerAbi } from "@intatto/config/abi"
import { sessionIndex } from "@intatto/config/session"
import { useIntatto, useMarketDeployment, type MarketSymbol } from "@/lib/chain"

export type ProtocolParams = {
  openLtvBps: bigint
  extendedLtvBps: bigint
  closedStartBps: bigint
  closedFloorBps: bigint
  closedDecaySeconds: bigint
  sessionLivenessSeconds: bigint
  penaltyBps: bigint
  liqOpenFloorBps: bigint
  liqClosedFloorBps: bigint
  liqClosedTimeoutFloorBps: bigint
  liqClosedTimeoutSeconds: bigint
}

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

/** Session limits and liquidation rules shared by every market. */
export function useProtocolParams() {
  const { deployment, publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["market-screen", "params", chainId, deployment?.sessionRisk, deployment?.liquidator],
    enabled: Boolean(deployment),
    refetchInterval: 60_000,
    queryFn: async (): Promise<ProtocolParams> => {
      const s = { address: deployment!.sessionRisk as Address, abi: sessionRiskControllerAbi } as const
      const l = { address: deployment!.liquidator as Address, abi: boundedLiquidatorAbi } as const
      const [open, extended, closed, closedFloor, decay, liveness, penalty, openFloor, liqClosed, liqTimeoutFloor, liqTimeout] =
        await Promise.all([
          publicClient.readContract({ ...s, functionName: "baseLtvBps", args: [sessionIndex("OPEN")] }),
          publicClient.readContract({ ...s, functionName: "baseLtvBps", args: [sessionIndex("EXTENDED")] }),
          publicClient.readContract({ ...s, functionName: "baseLtvBps", args: [sessionIndex("CLOSED")] }),
          publicClient.readContract({ ...s, functionName: "closedFloorBps" }),
          publicClient.readContract({ ...s, functionName: "closedDecayDuration" }),
          publicClient.readContract({ ...s, functionName: "livenessLimit" }),
          publicClient.readContract({ ...l, functionName: "penaltyBps" }),
          publicClient.readContract({ ...l, functionName: "openFloorBps" }),
          publicClient.readContract({ ...l, functionName: "closedFloorBps" }),
          publicClient.readContract({ ...l, functionName: "closedTimeoutFloorBps" }),
          publicClient.readContract({ ...l, functionName: "closedTimeout" }),
        ])
      return {
        openLtvBps: open,
        extendedLtvBps: extended,
        closedStartBps: closed,
        closedFloorBps: closedFloor,
        closedDecaySeconds: decay,
        sessionLivenessSeconds: liveness,
        penaltyBps: penalty,
        liqOpenFloorBps: openFloor,
        liqClosedFloorBps: liqClosed,
        liqClosedTimeoutFloorBps: liqTimeoutFloor,
        liqClosedTimeoutSeconds: liqTimeout,
      }
    },
  })
}

/** The relay's guard inputs for one market, refreshed with the lens reads. */
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
