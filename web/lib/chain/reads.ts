"use client"

/**
 * Shared onchain reads for every screen: one MarketLens call per concern, refreshed on a short interval.
 * All values are raw bigints in contract units (USDG 6 decimals, prices and token amounts 18 decimals, bps).
 */
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { marketLensAbi } from "@intatto/config/abi"
import { sessionFromIndex, type Session } from "@intatto/config/session"
import type { MarketDeployment } from "@intatto/config/deployments"
import { useIntatto } from "./context"

export type MarketSymbol = MarketDeployment["symbol"]

export type MarketState = {
  session: Session
  periodChangedAt: number
  sessionPostedAt: number
  maxLtvBps: bigint
  priceE18: bigint
  fetchedAt: number
  fresh: boolean
  inBand: boolean
  pegOk: boolean
  corporateActionPaused: boolean
  issuerPaused: boolean
  capUsdg: bigint
  sliceUsdg: bigint
  totalDebt: bigint
  totalShares: bigint
  totalCollateralValue: bigint
  assetsPerShare: bigint
  liquidationThresholdBps: bigint
}

export type AccountState = {
  shares: bigint
  assets: bigint
  valueUsdg: bigint
  debt: bigint
  ltvBps: bigint
  maxLtvBps: bigint
  borrowCapacity: bigint
  healthFactorE18: bigint
  liquidationPriceE18: bigint
  liquidatable: boolean
  walletToken: bigint
  walletUsdg: bigint
  vaultShares: bigint
  vaultAssets: bigint
}

export type VaultState = {
  idle: bigint
  totalAssets: bigint
  totalSupply: bigint
  sharePrice: bigint
  utilizationBps: bigint
  borrowRateBps: bigint
  supplyRateBps: bigint
  reserveBalance: bigint
  totalDeficit: bigint
  deficitCount: bigint
}

/** The deployment entry for `symbol`, or null when not deployed in the current mode. */
export function useMarketDeployment(symbol: MarketSymbol = "NVDAx"): MarketDeployment | null {
  const { deployment } = useIntatto()
  return deployment?.markets.find((m) => m.symbol === symbol) ?? null
}

function useLens<T>(key: string, fn: string, args: readonly unknown[] | null, map: (raw: never) => T, refetchMs = 12_000) {
  const { deployment, publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["lens", chainId, deployment?.lens, key, ...(args ?? []).map(String)],
    enabled: Boolean(deployment && args),
    refetchInterval: refetchMs,
    queryFn: async () => {
      const raw = await publicClient.readContract({
        address: deployment!.lens as Address,
        abi: marketLensAbi,
        functionName: fn,
        args: args!,
      } as never)
      return map(raw as never)
    },
  })
}

export function useMarketState(symbol: MarketSymbol = "NVDAx") {
  const m = useMarketDeployment(symbol)
  return useLens<MarketState>(`market:${symbol}`, "market", m ? [m.market] : null, (r: Record<string, unknown>) => ({
    ...(r as unknown as MarketState),
    session: sessionFromIndex(Number(r.session)),
    periodChangedAt: Number(r.periodChangedAt),
    sessionPostedAt: Number(r.sessionPostedAt),
    fetchedAt: Number(r.fetchedAt),
  }))
}

export function useAccountState(address: Address | undefined, symbol: MarketSymbol = "NVDAx") {
  const m = useMarketDeployment(symbol)
  return useLens<AccountState>(`account:${symbol}`, "account", m && address ? [m.market, address] : null, (r) => r as AccountState)
}

export function useVaultState(symbol: MarketSymbol = "NVDAx") {
  const m = useMarketDeployment(symbol)
  return useLens<VaultState>(`vault:${symbol}`, "vault", m ? [m.market] : null, (r) => r as VaultState)
}
