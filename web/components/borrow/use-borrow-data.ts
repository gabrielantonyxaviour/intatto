"use client"

import { useAccount } from "wagmi"
import {
  useAccountState,
  useIntatto,
  useMarketDeployment,
  useMarketState,
  useVaultState,
  useProtocolParams,
  type MarketSymbol,
} from "@/lib/chain"

/** Everything the borrow screen reads for the selected market: the market, the vault, the account and the wallet. */
export function useBorrowData(symbol: MarketSymbol) {
  const { deployment, chainId, mode } = useIntatto()
  const market = useMarketDeployment(symbol)
  const { address, chainId: walletChainId, isConnected } = useAccount()
  const m = useMarketState(symbol)
  const v = useVaultState(symbol)
  const a = useAccountState(address, symbol)

  const params = useProtocolParams(symbol)
  const decay = params.data ? { floorBps: params.data.session.closedFloorBps, duration: Number(params.data.session.closedDecayDuration) } : null

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
    decay,
    params,
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
