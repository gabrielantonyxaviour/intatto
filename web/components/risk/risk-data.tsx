"use client"

/** Everything the console's views read, loaded once for the selected market and shared through context. */
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import type { Address, Block } from "viem"
import type { Deployment, MarketDeployment } from "@intatto/config/deployments"
import { useIntatto, useMarketState, useVaultState, type MarketState, type VaultState } from "@/lib/chain"
import { classify, type MarketRows } from "./events"
import { useRiskLogs, type RiskLogs } from "./use-risk-logs"
import { useRiskParams, type RiskParams } from "./use-risk-params"
import { useLoans, type LoansSnapshot } from "./use-loans"

export type RiskData = {
  deployment: Deployment
  market: MarketDeployment
  logs: RiskLogs
  rows: MarketRows
  /** Who sent each permissionless transaction (resolve, clear, waiting slice). */
  senders: Map<string, Address>
  params: UseQueryResult<RiskParams>
  marketState: UseQueryResult<MarketState>
  vaultState: UseQueryResult<VaultState>
  loans: UseQueryResult<LoansSnapshot>
  /** Latest block timestamp: "now" on this chain (a sandbox fork may be warped ahead of wall time). */
  now: number | null
  latestBlock: bigint | null
  /** The connected wallet, if any, to mark its own loan. */
  account: Address | undefined
}

const Ctx = createContext<RiskData | null>(null)

/** Shares the sandbox banner's cache entry, so both read the same block. */
export function useLatestBlock() {
  const { publicClient, chainId } = useIntatto()
  return useQuery<Block>({
    queryKey: ["intatto:latest-block", chainId],
    queryFn: () => publicClient.getBlock({ blockTag: "latest" }),
    refetchInterval: 5_000,
    retry: 1,
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
  const marketState = useMarketState(market.symbol)
  const vaultState = useVaultState(market.symbol)
  const loans = useLoans(market, borrowers)
  const latest = useLatestBlock()

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
      now: latest.data ? Number(latest.data.timestamp) : null,
      latestBlock: latest.data?.number ?? null,
      account,
    }),
    [deployment, market, logs, rows, params, marketState, vaultState, loans, latest.data, account],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRisk(): RiskData {
  const v = useContext(Ctx)
  if (!v) throw new Error("useRisk must be used inside <RiskDataProvider>")
  return v
}
