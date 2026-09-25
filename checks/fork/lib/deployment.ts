/** Turns Deploy.s.sol's flat JSON output into config/deployments.ts's schema. */
import { parseDeployment, type Deployment, type MarketDeployment } from "@intatto/config/deployments"

type Flat = Record<string, string | number | boolean>

export function deploymentFromFlat(flat: Flat): Deployment {
  const markets: MarketDeployment[] = []
  for (const symbol of ["NVDAx", "SPYx"] as const) {
    if (!flat[`${symbol}.market`]) continue
    markets.push({
      symbol,
      market: String(flat[`${symbol}.market`]),
      priceRelay: String(flat[`${symbol}.priceRelay`]),
      corporateActionGuard: String(flat[`${symbol}.corporateActionGuard`]),
      token: String(flat[`${symbol}.token`]),
      wrapper: String(flat[`${symbol}.wrapper`]),
      pool: String(flat[`${symbol}.pool`]),
    })
  }
  return parseDeployment({
    chainId: Number(flat.chainId),
    block: Number(flat.block),
    deployedAt: new Date(Number(flat.deployedAt) * 1000).toISOString(),
    operator: flat.operator,
    keeper: flat.keeper,
    usdg: flat.usdg,
    vault: flat.vault,
    gapReserve: flat.gapReserve,
    sessionRisk: flat.sessionRisk,
    depthCaps: flat.depthCaps,
    liquidator: flat.liquidator,
    interestRateModel: flat.interestRateModel,
    lens: flat.lens,
    markets,
  })
}
