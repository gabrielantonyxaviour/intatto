"use client"

import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import type { Abi, Address } from "viem"
import {
  boundedLiquidatorAbi, collateralMarketAbi, corporateActionGuardAbi, interestRateModelAbi,
  priceRelayAdapterAbi, sessionRiskControllerAbi,
} from "@intatto/config/abi"
import { deploymentSchema, type Deployment } from "@intatto/config/deployments"
import { useIntatto } from "./context"
import type { MarketSymbol } from "./reads"

export type ProtocolParams = {
  blockNumber: bigint
  blockTimestamp: bigint
  market: { liquidationThresholdBps: bigint; penaltyBps: bigint; reserveFactorBps: bigint }
  session: {
    openBps: bigint; extendedBps: bigint; closedStartBps: bigint
    closedFloorBps: bigint; closedDecayDuration: bigint; livenessLimit: bigint
    table: Record<"OPEN" | "EXTENDED" | "CLOSED", { atZeroBps: bigint; atDecayBps: bigint }>
  }
  relay: {
    bandOpenBps: bigint; bandOtherBps: bigint; maxMoveBps: bigint; maxFetchAge: bigint
    priceLiveness: bigint; usdgMaxAge: bigint; pegBps: bigint; twapWindow: bigint
  }
  guard: { window: bigint; toleranceBps: bigint }
  liquidator: { openFloorBps: bigint; closedFloorBps: bigint; closedTimeoutFloorBps: bigint; closedTimeout: bigint }
  rateModel: { baseBps: bigint; slope1Bps: bigint; slope2Bps: bigint; kinkBps: bigint }
}
export type ProtocolParamsStatus = "loading" | "success" | "error" | "unavailable"
export type ProtocolParamsResult<T = ProtocolParams> =
  | { status: "success"; data: T }
  | { status: Exclude<ProtocolParamsStatus, "success">; data: undefined }

type ReadRequest = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; blockNumber: bigint }
export type ProtocolParamsClient = {
  getBlock: () => Promise<{ number: bigint | null; timestamp: bigint }>
  readContract: (request: ReadRequest) => Promise<unknown>
}
const uint = z.union([z.bigint().nonnegative(), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
  .transform((value) => BigInt(value))

/** Atomic snapshot: one failed/invalid read rejects the whole result, with no numeric defaults. */
export async function readProtocolParams(client: ProtocolParamsClient, input: Deployment, symbol: MarketSymbol): Promise<ProtocolParams> {
  const deployment = deploymentSchema.parse(input)
  const market = deployment.markets.find((m) => m.symbol === symbol)
  if (!market) throw new Error(`${symbol} is not deployed on the active chain`)
  const block = await client.getBlock()
  const blockNumber = uint.parse(block.number)
  const blockTimestamp = uint.parse(block.timestamp)
  async function read(address: string, abi: Abi, functionName: string, args?: readonly unknown[]) {
    return uint.parse(await client.readContract({ address: address as Address, abi, functionName, args, blockNumber }))
  }
  async function fields<K extends string>(address: string, abi: Abi, names: readonly K[]): Promise<Record<K, bigint>> {
    const values = await Promise.all(names.map((name) => read(address, abi, name)))
    return Object.fromEntries(names.map((name, index) => [name, values[index]!])) as Record<K, bigint>
  }
  const [m, s, relay, guard, liquidator, rateModel] = await Promise.all([
    fields(market.market, collateralMarketAbi, ["LIQUIDATION_THRESHOLD_BPS", "PENALTY_BPS", "RESERVE_FACTOR_BPS"]),
    fields(deployment.sessionRisk, sessionRiskControllerAbi, ["closedFloorBps", "closedDecayDuration", "livenessLimit"]),
    fields(market.priceRelay, priceRelayAdapterAbi, ["bandOpenBps", "bandOtherBps", "maxMoveBps", "maxFetchAge", "priceLiveness", "usdgMaxAge", "pegBps", "twapWindow"]),
    fields(market.corporateActionGuard, corporateActionGuardAbi, ["window", "toleranceBps"]),
    fields(deployment.liquidator, boundedLiquidatorAbi, ["openFloorBps", "closedFloorBps", "closedTimeoutFloorBps", "closedTimeout"]),
    fields(deployment.interestRateModel, interestRateModelAbi, ["baseBps", "slope1Bps", "slope2Bps", "kinkBps"]),
  ])
  const endpoints = await Promise.all([1, 2, 3].map(async (session) => {
    const [atZeroBps, atDecayBps] = await Promise.all([0n, s.closedDecayDuration].map((elapsed) =>
      read(deployment.sessionRisk, sessionRiskControllerAbi, "maxLtvBpsFor", [session, elapsed])))
    return { atZeroBps: atZeroBps!, atDecayBps: atDecayBps! }
  }))
  const [OPEN, EXTENDED, CLOSED] = endpoints as [typeof endpoints[number], typeof endpoints[number], typeof endpoints[number]]
  return {
    blockNumber, blockTimestamp,
    market: { liquidationThresholdBps: m.LIQUIDATION_THRESHOLD_BPS, penaltyBps: m.PENALTY_BPS, reserveFactorBps: m.RESERVE_FACTOR_BPS },
    session: { ...s, openBps: OPEN.atZeroBps, extendedBps: EXTENDED.atZeroBps, closedStartBps: CLOSED.atZeroBps, table: { OPEN, EXTENDED, CLOSED } },
    relay, guard, liquidator, rateModel,
  }
}

/** Suppress React Query's cached success data during loading or a failed refresh. */
export function protocolParamsResult<T>(available: boolean, fetching: boolean, failed: boolean, data: T | undefined): ProtocolParamsResult<T> {
  if (!available) return { status: "unavailable", data: undefined }
  if (fetching) return { status: "loading", data: undefined }
  if (failed) return { status: "error", data: undefined }
  if (data === undefined) return { status: "loading", data: undefined }
  return { status: "success", data }
}

export function useProtocolParams(symbol: MarketSymbol = "NVDAx"): ProtocolParamsResult {
  const { deployment, publicClient, chainId, mode, rpcUrl, sandbox, hydrated } = useIntatto()
  const market = deployment?.markets.find((m) => m.symbol === symbol)
  const available = hydrated && Boolean(deployment && market)
  const query = useQuery({
    queryKey: ["protocol-params", mode, chainId, rpcUrl, sandbox?.sessionId, symbol, deployment],
    enabled: available,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
    queryFn: () => {
      if (!deployment) throw new Error("No active deployment")
      return readProtocolParams(publicClient, deployment, symbol)
    },
  })
  if (!hydrated) return { status: "loading", data: undefined }
  return protocolParamsResult(available, query.isFetching, query.isError, query.data)
}
