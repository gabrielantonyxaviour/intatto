import { decodeEventLog, decodeFunctionData, erc20Abi, getAddress, type Abi, type Address, type Hex, type Log } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  boundedLiquidatorAbi,
  collateralMarketAbi,
  corporateActionGuardAbi,
  depthCapRegistryAbi,
  gapReserveAbi,
  interestRateModelAbi,
  lendingVaultAbi,
  marketLensAbi,
  priceRelayAdapterAbi,
  sessionRiskControllerAbi,
} from "@intatto/config/abi"
import type { SandboxSession } from "@/lib/chain"

/** What the fork explorer knows about an address: a readable name and the ABI to decode it with. */
export type Known = { name: string; abi: Abi }

/** Names every Intatto contract, token and the session's burner, keyed by checksummed address. */
export function knownAddresses(session: SandboxSession): Map<Address, Known> {
  const d = session.deployment
  const m = new Map<Address, Known>()
  const add = (a: string | undefined, name: string, abi: Abi) => {
    if (a) m.set(getAddress(a), { name, abi })
  }
  add(d.usdg, "USDG", erc20Abi)
  add(d.vault, "LendingVault", lendingVaultAbi)
  add(d.gapReserve, "GapReserve", gapReserveAbi)
  add(d.sessionRisk, "SessionRiskController", sessionRiskControllerAbi)
  add(d.depthCaps, "DepthCapRegistry", depthCapRegistryAbi)
  add(d.liquidator, "BoundedLiquidator", boundedLiquidatorAbi)
  add(d.interestRateModel, "InterestRateModel", interestRateModelAbi)
  add(d.lens, "MarketLens", marketLensAbi)
  for (const mk of d.markets) {
    add(mk.market, `CollateralMarket (${mk.symbol})`, collateralMarketAbi)
    add(mk.priceRelay, `PriceRelayAdapter (${mk.symbol})`, priceRelayAdapterAbi)
    add(mk.corporateActionGuard, `CorporateActionGuard (${mk.symbol})`, corporateActionGuardAbi)
    add(mk.token, mk.symbol, erc20Abi)
    add(mk.wrapper, `Wrapped ${mk.symbol}`, erc20Abi)
  }
  add(d.keeper, "Keeper", [])
  add(d.operator, "Operator", [])
  add(privateKeyToAccount(session.burnerKey).address, "Your sandbox wallet", [])
  return m
}

export function nameOf(known: Map<Address, Known>, a: string | null | undefined): string | null {
  if (!a) return null
  try {
    return known.get(getAddress(a))?.name ?? null
  } catch {
    return null
  }
}

export type DecodedArg = { name: string; value: string }
export type DecodedCall = { fn: string; args: DecodedArg[] }

function show(v: unknown): string {
  if (typeof v === "bigint") return v.toString()
  if (Array.isArray(v)) return `[${v.map(show).join(", ")}]`
  if (v && typeof v === "object") return JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
  return String(v)
}

function namedArgs(abi: Abi, kind: "function" | "event", name: string, args: unknown): DecodedArg[] {
  const item = abi.find((i) => i.type === kind && "name" in i && i.name === name)
  const inputs = item && "inputs" in item ? item.inputs : []
  if (Array.isArray(args)) return args.map((v, i) => ({ name: inputs[i]?.name || `arg${i}`, value: show(v) }))
  if (args && typeof args === "object") return Object.entries(args).map(([k, v]) => ({ name: k, value: show(v) }))
  return []
}

/** Decodes calldata against the called contract's ABI, else every known ABI. Null when nothing matches. */
export function decodeCall(known: Map<Address, Known>, to: string | null, input: Hex): DecodedCall | null {
  if (!input || input === "0x") return null
  const target = to ? known.get(getAddress(to)) : undefined
  const abis = target?.abi.length ? [target.abi] : [...new Set([...known.values()].map((k) => k.abi))]
  for (const abi of abis) {
    try {
      const r = decodeFunctionData({ abi, data: input })
      return { fn: r.functionName, args: namedArgs(abi, "function", r.functionName, r.args) }
    } catch {
      // try the next ABI
    }
  }
  return null
}

export type DecodedLog = { index: number; address: string; contract: string | null; event: string | null; args: DecodedArg[]; topics: readonly Hex[]; data: Hex }

export function decodeLogs(known: Map<Address, Known>, logs: readonly Log[]): DecodedLog[] {
  const abis = [...new Set([...known.values()].map((k) => k.abi).filter((a) => a.length))]
  return logs.map((log, i) => {
    const own = known.get(getAddress(log.address))
    const order = own?.abi.length ? [own.abi, ...abis] : abis
    for (const abi of order) {
      try {
        const r = decodeEventLog({ abi, data: log.data, topics: log.topics as [Hex, ...Hex[]] })
        const event = r.eventName ?? null
        return { index: log.logIndex ?? i, address: log.address, contract: own?.name ?? null, event, args: event ? namedArgs(abi, "event", event, r.args) : [], topics: log.topics, data: log.data }
      } catch {
        // try the next ABI
      }
    }
    return { index: log.logIndex ?? i, address: log.address, contract: own?.name ?? null, event: null, args: [], topics: log.topics, data: log.data }
  })
}
