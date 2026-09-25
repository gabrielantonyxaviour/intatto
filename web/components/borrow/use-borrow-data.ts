"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import type { Address } from "viem"
import { sessionRiskControllerAbi } from "@intatto/config/abi"
import {
  useAccountState,
  useIntatto,
  useMarketDeployment,
  useMarketState,
  useVaultState,
  type MarketSymbol,
} from "@/lib/chain"

/** Everything the borrow screen reads for the selected market: the market, the vault, the account and the wallet. */
export function useBorrowData(symbol: MarketSymbol) {
  const { deployment, chainId, publicClient, mode } = useIntatto()
  const market = useMarketDeployment(symbol)
  const { address, chainId: walletChainId, isConnected } = useAccount()
  const m = useMarketState(symbol)
  const v = useVaultState(symbol)
  const a = useAccountState(address, symbol)

  // CLOSED decays toward a floor; read it so the screen can say where the limit is heading.
  const closed = m.data?.session === "CLOSED"
  const decay = useQuery({
    queryKey: ["borrow:closed-decay", chainId, deployment?.sessionRisk ?? null],
    enabled: Boolean(deployment && closed),
    staleTime: 60_000,
    queryFn: async () => {
      const at = deployment!.sessionRisk as Address
      const [floorBps, duration] = await Promise.all([
        publicClient.readContract({ address: at, abi: sessionRiskControllerAbi, functionName: "closedFloorBps" }),
        publicClient.readContract({ address: at, abi: sessionRiskControllerAbi, functionName: "closedDecayDuration" }),
      ])
      return { floorBps: floorBps as bigint, duration: Number(duration as bigint) }
    },
  })

  const loading = m.isPending || v.isPending || (Boolean(address) && a.isPending)
  const failed = m.isError || v.isError || a.isError
  const error = (m.error ?? v.error ?? a.error) as Error | null

  return {
    mode,
    deployment,
    market,
    address,
    isConnected,
    wrongNetwork: isConnected && walletChainId !== chainId,
    m: m.data ?? null,
    v: v.data ?? null,
    a: a.data ?? null,
    decay: decay.data ?? null,
    loading: Boolean(deployment && market) && loading && !failed,
    failed,
    error,
    refetchAccount: () => a.refetch(),
    retry: () => {
      void m.refetch()
      void v.refetch()
      if (address) void a.refetch()
    },
  }
}

export type BorrowData = ReturnType<typeof useBorrowData>
