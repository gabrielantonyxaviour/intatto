import type { ProtocolParams } from "@/lib/chain"
import { bpsShort, duration } from "@/components/market/format"
import type { CreditReport } from "@/lib/credit/compute"

export const GUARD_ORDER = ["fresh", "inBand", "pegOk", "corporateActionPaused", "issuerPaused"] as const
export type GuardKey = (typeof GUARD_ORDER)[number]

const GOOD_WHEN_TRUE = new Set<GuardKey>(["fresh", "inBand", "pegOk"])

export function guardIsGood(key: GuardKey, on: boolean): boolean {
  return GOOD_WHEN_TRUE.has(key) ? on : !on
}

/** Live relay bounds when the read succeeded. Otherwise the limit is left off, never a typed stand-in. */
export function guardLabel(key: GuardKey, params: ProtocolParams | undefined): string {
  const relay = params?.relay
  if (key === "fresh") return relay ? `Keeper post under ${duration(relay.priceLiveness)}` : "Keeper price post freshness"
  if (key === "inBand") return relay ? `Inside the ${duration(relay.twapWindow)} pool band` : "Inside the pool band"
  if (key === "pegOk") return relay ? `USDG within ${bpsShort(relay.pegBps)} of peg` : "USDG peg"
  if (key === "corporateActionPaused") return "Corporate action pause"
  return "Issuer pause"
}

export function guardOn(guards: CreditReport["guards"], key: GuardKey): boolean {
  return guards[key]
}
