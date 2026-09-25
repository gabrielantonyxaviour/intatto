import type { Address } from "viem"
import type { Deployment } from "@intatto/config/deployments"

/** Every contract whose events the risk console reads, across all markets of the deployment (lowercase, unique). */
export function watchedAddresses(d: Deployment): Address[] {
  const list = [d.sessionRisk, d.depthCaps, d.liquidator]
  for (const m of d.markets) list.push(m.priceRelay, m.corporateActionGuard, m.market)
  return [...new Set(list.map((a) => a.toLowerCase()))] as Address[]
}

/** eth_getLogs on the public X Layer endpoints is capped at about 100 blocks per call. */
export const LOG_CHUNK = 100

/** A log as eth_getLogs returns it (hex quantities). */
export type RawLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  logIndex: string
  blockTimestamp?: string
}
