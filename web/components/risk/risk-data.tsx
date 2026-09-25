"use client"

/** Everything the console's views read, loaded once for the selected market and shared through context. */
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import type { Address } from "viem"
import { marketLensAbi } from "@intatto/config/abi"
import { sessionFromIndex } from "@intatto/config/session"
import type { Deployment, MarketDeployment } from "@intatto/config/deployments"
import { useIntatto, type MarketState, type VaultState } from "@/lib/chain"
import { classify, type MarketRows } from "./events"
import { useRiskLogs, type RiskLogs } from "./use-risk-logs"
import { useRiskParams, type RiskParams } from "./use-risk-params"
import { useLoans, type LoansSnapshot } from "./use-loans"

/** One lens snapshot. Market and vault are the same block, and that block is the one the summary names. */
export type PinnedSnapshot = { blockNumber: bigint; time: number; market: MarketState; vault: VaultState }

export type ReadSlice<T> = {
  data: T | undefined
  isError: boolean
  isPending: boolean
  error: Error | null
  refetch: () => Promise<unknown>
}

export type RiskData = {
  deployment: Deployment
  market: MarketDeployment
  logs: RiskLogs
  rows: MarketRows
  /** Who sent each permissionless transaction (resolve, clear, waiting slice). */
  senders: Map<string, Address>
  params: UseQueryResult<RiskParams>
  marketState: ReadSlice<MarketState>
  vaultState: ReadSlice<VaultState>
  loans: UseQueryResult<LoansSnapshot>
  /** Block time of the pinned market/vault snapshot (a sandbox fork may be warped ahead of wall time). */
  now: number | null
  latestBlock: bigint | null
  /** The connected wallet, if any, to mark its own loan. */
  account: Address | undefined
}

const Ctx = createContext<RiskData | null>(null)

function usePinnedSnapshot(market: MarketDeployment) {
  const { deployment, publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["risk-pinned", chainId, deployment?.lens, market.market],
    enabled: Boolean(deployment),
    refetchInterval: 12_000,
    queryFn: async (): Promise<PinnedSnapshot> => {
      const block = await publicClient.getBlock({ blockTag: "latest" })
      const at = block.number
      const [rawM, rawV] = await Promise.all([
        publicClient.readContract({ address: deployment!.lens as Address, abi: marketLensAbi, functionName: "market", args: [market.market as Address], blockNumber: at }),
        publicClient.readContract({ address: deployment!.lens as Address, abi: marketLensAbi, functionName: "vault", args: [market.market as Address], blockNumber: at }),
      ])
      const m = rawM as Record<string, unknown>
      return {
        blockNumber: at,
        time: Number(block.timestamp),
        market: {
          ...(m as unknown as MarketState),
          session: sessionFromIndex(Number(m.session)),
          periodChangedAt: Number(m.periodChangedAt),
          sessionPostedAt: Number(m.sessionPostedAt),
          fetchedAt: Number(m.fetchedAt),
        },
        vault: rawV as VaultState,
      }
    },
  })
}

export function RiskDataProvider({
  deployment,
  market,
  account,
  children,
}: {
  deployment: Deployment
  market: MarketDeployment
  account: Address | undefined
  children: ReactNode
}) {
  const logs = useRiskLogs()
  const rows = useMemo(() => classify(logs.logs, deployment, market, logs.times), [logs.logs, logs.times, deployment, market])
  const borrowers = useMemo(() => [...new Set(rows.borrows.map((b) => b.user.toLowerCase()))] as Address[], [rows.borrows])
  const params = useRiskParams(market)
  const pinned = usePinnedSnapshot(market)
  const loans = useLoans(market, borrowers)
  const refetch = () => pinned.refetch()
  const marketState: ReadSlice<MarketState> = {
    data: pinned.data?.market,
    isError: pinned.isError,
    isPending: pinned.isPending,
    error: pinned.error instanceof Error ? pinned.error : null,
    refetch,
  }
  const vaultState: ReadSlice<VaultState> = {
    data: pinned.data?.vault,
    isError: pinned.isError,
    isPending: pinned.isPending,
    error: pinned.error instanceof Error ? pinned.error : null,
    refetch,
  }

  const value = useMemo<RiskData>(
    () => ({
      deployment,
      market,
      logs,
      rows,
      senders: logs.senders,
      params,
      marketState,
      vaultState,
      loans,
      now: pinned.data?.time ?? null,
      latestBlock: pinned.data?.blockNumber ?? null,
      account,
    }),
    [deployment, market, logs, rows, params, marketState, vaultState, loans, pinned.data, account],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRisk(): RiskData {
  const v = useContext(Ctx)
  if (!v) throw new Error("useRisk must be used inside <RiskDataProvider>")
  return v
}
