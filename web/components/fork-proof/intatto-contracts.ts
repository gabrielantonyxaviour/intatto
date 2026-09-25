/**
 * Which Intatto contract sits at which deployment key. Shared by the build-time artifact generator (Node)
 * and check 4 in the browser, so it only has a type import.
 */
import type { Deployment } from "@intatto/config/deployments"

export const ARTIFACT_NAMES = [
  "LendingVault",
  "GapReserve",
  "InterestRateModel",
  "SessionRiskController",
  "DepthCapRegistry",
  "BoundedLiquidator",
  "MarketLens",
  "ChainlinkV10Adapter",
  "CollateralMarket",
  "PriceRelayAdapter",
  "CorporateActionGuard",
] as const

export type ArtifactName = (typeof ARTIFACT_NAMES)[number]

type CoreKey = "vault" | "gapReserve" | "interestRateModel" | "sessionRisk" | "depthCaps" | "liquidator" | "lens" | "chainlinkV10Adapter"
type MarketKey = "market" | "priceRelay" | "corporateActionGuard"

const CORE: { key: CoreKey; contract: ArtifactName; label: string }[] = [
  { key: "vault", contract: "LendingVault", label: "Lending vault" },
  { key: "gapReserve", contract: "GapReserve", label: "Gap reserve" },
  { key: "interestRateModel", contract: "InterestRateModel", label: "Interest rate model" },
  { key: "sessionRisk", contract: "SessionRiskController", label: "Session risk controller" },
  { key: "depthCaps", contract: "DepthCapRegistry", label: "Depth cap registry" },
  { key: "liquidator", contract: "BoundedLiquidator", label: "Bounded liquidator" },
  { key: "lens", contract: "MarketLens", label: "Market lens" },
  { key: "chainlinkV10Adapter", contract: "ChainlinkV10Adapter", label: "Chainlink v10 adapter" },
]

const PER_MARKET: { key: MarketKey; contract: ArtifactName; label: string }[] = [
  { key: "market", contract: "CollateralMarket", label: "market" },
  { key: "priceRelay", contract: "PriceRelayAdapter", label: "price relay" },
  { key: "corporateActionGuard", contract: "CorporateActionGuard", label: "corporate-action guard" },
]

export type IntattoTarget = {
  /** Stable id, e.g. "lens" or "NVDAx.market"; used to pair sandbox and mainnet addresses. */
  id: string
  label: string
  contract: ArtifactName
  address: `0x${string}`
}

/** Every Intatto contract in a deployment, in a fixed order. */
export function intattoTargets(d: Deployment): IntattoTarget[] {
  const out: IntattoTarget[] = []
  for (const c of CORE) {
    const address = d[c.key]
    if (address) out.push({ id: c.key, label: c.label, contract: c.contract, address: address as `0x${string}` })
  }
  for (const m of d.markets) {
    for (const c of PER_MARKET) {
      out.push({ id: `${m.symbol}.${c.key}`, label: `${m.symbol} ${c.label}`, contract: c.contract, address: m[c.key] as `0x${string}` })
    }
  }
  return out
}
