/**
 * The shape every Intatto deployment is described by, mainnet or fork.
 * deployments/xlayer-mainnet.json (written by the mainnet deploy) and the fork harness's
 * output both follow it, so the web app, keeper, credit API and checks read one format.
 */
import { z } from "zod"

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected a 0x address")

export const marketDeploymentSchema = z.object({
  symbol: z.enum(["NVDAx", "SPYx"]),
  market: address,
  priceRelay: address,
  corporateActionGuard: address,
  token: address,
  wrapper: address,
  pool: address,
})

export const deploymentSchema = z.object({
  chainId: z.number().int(),
  /** Block the deployment (or the fork) was taken at. */
  block: z.number().int().nonnegative(),
  deployedAt: z.string(),
  operator: address,
  keeper: address,
  usdg: address,
  vault: address,
  gapReserve: address,
  sessionRisk: address,
  depthCaps: address,
  liquidator: address,
  interestRateModel: address,
  lens: address,
  chainlinkV10Adapter: address.optional(),
  markets: z.array(marketDeploymentSchema).min(1),
})

export type Deployment = z.infer<typeof deploymentSchema>
export type MarketDeployment = z.infer<typeof marketDeploymentSchema>

export function parseDeployment(input: unknown): Deployment {
  return deploymentSchema.parse(input)
}

export function marketFor(deployment: Deployment, symbol: MarketDeployment["symbol"] = "NVDAx"): MarketDeployment {
  const found = deployment.markets.find((m) => m.symbol === symbol)
  if (!found) throw new Error(`deployment has no ${symbol} market`)
  return found
}
