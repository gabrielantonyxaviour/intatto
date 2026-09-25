"use client"

/** The bounds the contracts enforce, read onchain so the console never repeats a stale default. */
import { useQuery } from "@tanstack/react-query"
import type { Abi, Address } from "viem"
import {
  boundedLiquidatorAbi,
  collateralMarketAbi,
  corporateActionGuardAbi,
  depthCapRegistryAbi,
  priceRelayAdapterAbi,
  sessionRiskControllerAbi,
} from "@intatto/config/abi"
import type { MarketDeployment } from "@intatto/config/deployments"
import { useIntatto } from "@/lib/chain"

export type RiskParams = {
  keeper: Address | null
  owner: Address | null
  relay: {
    bandOpenBps?: bigint
    bandOtherBps?: bigint
    maxMoveBps?: bigint
    maxFetchAge?: bigint
    priceLiveness?: bigint
    usdgMaxAge?: bigint
    pegBps?: bigint
    twapWindow?: number
  }
  session: {
    livenessLimit?: bigint
    openBps?: bigint
    extendedBps?: bigint
    closedStartBps?: bigint
    closedFloorBps?: bigint
    closedDecayDuration?: bigint
  }
  caps: { stepBps?: bigint; minStepUsdg?: bigint }
  liquidator: {
    openFloorBps?: bigint
    closedFloorBps?: bigint
    closedTimeoutFloorBps?: bigint
    closedTimeout?: bigint
    penaltyBps?: bigint
  }
  guard: { window?: bigint; toleranceBps?: bigint }
  market: { liquidationThresholdBps?: bigint; penaltyBps?: bigint; reserveFactorBps?: bigint }
}

export function useRiskParams(market: MarketDeployment | null) {
  const { deployment, publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["risk-params", chainId, market?.market ?? null],
    enabled: Boolean(deployment && market),
    refetchInterval: 120_000,
    queryFn: async (): Promise<RiskParams> => {
      const d = deployment!
      const m = market!
      const reads: [string, Address, Abi, string, readonly unknown[]][] = [
        ["keeper", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "keeper", []],
        ["owner", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "owner", []],
        ["bandOpenBps", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "bandOpenBps", []],
        ["bandOtherBps", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "bandOtherBps", []],
        ["maxMoveBps", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "maxMoveBps", []],
        ["maxFetchAge", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "maxFetchAge", []],
        ["priceLiveness", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "priceLiveness", []],
        ["usdgMaxAge", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "usdgMaxAge", []],
        ["pegBps", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "pegBps", []],
        ["twapWindow", m.priceRelay as Address, priceRelayAdapterAbi as Abi, "twapWindow", []],
        ["livenessLimit", d.sessionRisk as Address, sessionRiskControllerAbi as Abi, "livenessLimit", []],
        ["openBps", d.sessionRisk as Address, sessionRiskControllerAbi as Abi, "baseLtvBps", [1]],
        ["extendedBps", d.sessionRisk as Address, sessionRiskControllerAbi as Abi, "baseLtvBps", [2]],
        ["closedStartBps", d.sessionRisk as Address, sessionRiskControllerAbi as Abi, "baseLtvBps", [3]],
        ["sessionClosedFloorBps", d.sessionRisk as Address, sessionRiskControllerAbi as Abi, "closedFloorBps", []],
        ["closedDecayDuration", d.sessionRisk as Address, sessionRiskControllerAbi as Abi, "closedDecayDuration", []],
        ["stepBps", d.depthCaps as Address, depthCapRegistryAbi as Abi, "stepBps", []],
        ["minStepUsdg", d.depthCaps as Address, depthCapRegistryAbi as Abi, "minStepUsdg", []],
        ["openFloorBps", d.liquidator as Address, boundedLiquidatorAbi as Abi, "openFloorBps", []],
        ["liqClosedFloorBps", d.liquidator as Address, boundedLiquidatorAbi as Abi, "closedFloorBps", []],
        ["closedTimeoutFloorBps", d.liquidator as Address, boundedLiquidatorAbi as Abi, "closedTimeoutFloorBps", []],
        ["closedTimeout", d.liquidator as Address, boundedLiquidatorAbi as Abi, "closedTimeout", []],
        ["liqPenaltyBps", d.liquidator as Address, boundedLiquidatorAbi as Abi, "penaltyBps", []],
        ["window", m.corporateActionGuard as Address, corporateActionGuardAbi as Abi, "window", []],
        ["toleranceBps", m.corporateActionGuard as Address, corporateActionGuardAbi as Abi, "toleranceBps", []],
        ["liquidationThresholdBps", m.market as Address, collateralMarketAbi as Abi, "LIQUIDATION_THRESHOLD_BPS", []],
        ["marketPenaltyBps", m.market as Address, collateralMarketAbi as Abi, "PENALTY_BPS", []],
        ["reserveFactorBps", m.market as Address, collateralMarketAbi as Abi, "RESERVE_FACTOR_BPS", []],
      ]
      // One failed read leaves its value unknown instead of blanking the whole sheet.
      const settled = await Promise.allSettled(
        reads.map(([, address, abi, functionName, args]) => publicClient.readContract({ address, abi, functionName, args })),
      )
      const v: Record<string, unknown> = {}
      settled.forEach((s, i) => {
        if (s.status === "fulfilled") v[reads[i]![0]] = s.value
      })
      if (settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason
      const b = (k: string) => (typeof v[k] === "bigint" ? (v[k] as bigint) : undefined)
      return {
        keeper: (v.keeper as Address | undefined) ?? null,
        owner: (v.owner as Address | undefined) ?? null,
        relay: {
          bandOpenBps: b("bandOpenBps"),
          bandOtherBps: b("bandOtherBps"),
          maxMoveBps: b("maxMoveBps"),
          maxFetchAge: b("maxFetchAge"),
          priceLiveness: b("priceLiveness"),
          usdgMaxAge: b("usdgMaxAge"),
          pegBps: b("pegBps"),
          twapWindow: v.twapWindow === undefined ? undefined : Number(v.twapWindow),
        },
        session: {
          livenessLimit: b("livenessLimit"),
          openBps: b("openBps"),
          extendedBps: b("extendedBps"),
          closedStartBps: b("closedStartBps"),
          closedFloorBps: b("sessionClosedFloorBps"),
          closedDecayDuration: b("closedDecayDuration"),
        },
        caps: { stepBps: b("stepBps"), minStepUsdg: b("minStepUsdg") },
        liquidator: {
          openFloorBps: b("openFloorBps"),
          closedFloorBps: b("liqClosedFloorBps"),
          closedTimeoutFloorBps: b("closedTimeoutFloorBps"),
          closedTimeout: b("closedTimeout"),
          penaltyBps: b("liqPenaltyBps"),
        },
        guard: { window: b("window"), toleranceBps: b("toleranceBps") },
        market: {
          liquidationThresholdBps: b("liquidationThresholdBps"),
          penaltyBps: b("marketPenaltyBps"),
          reserveFactorBps: b("reserveFactorBps"),
        },
      }
    },
  })
}
