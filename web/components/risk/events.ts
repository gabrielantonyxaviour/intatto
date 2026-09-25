/**
 * Every onchain event the risk console reads, decoded into plain rows. Pure: no React, no network.
 * Units stay raw: USDG 6 decimals, quotes and wrapper prices 18 decimals (USD), liquidator prices
 * USDG (6 decimals) per 1e18 wrapper shares, multipliers 1e18 = 1.0, bps as bigint.
 */
import type { AbiEvent, Address, Hex } from "viem"
import {
  boundedLiquidatorAbi,
  collateralMarketAbi,
  corporateActionGuardAbi,
  depthCapRegistryAbi,
  priceRelayAdapterAbi,
  sessionRiskControllerAbi,
} from "@intatto/config/abi"
import { sessionFromIndex, type Session } from "@intatto/config/session"
import type { Deployment, MarketDeployment } from "@intatto/config/deployments"

function event(abi: readonly unknown[], name: string): AbiEvent {
  const found = abi.find((i) => (i as AbiEvent).type === "event" && (i as AbiEvent).name === name)
  if (!found) throw new Error(`event ${name} missing from the ABI`)
  return found as AbiEvent
}

export const RISK_EVENTS: AbiEvent[] = [
  event(priceRelayAdapterAbi, "PricePosted"),
  event(priceRelayAdapterAbi, "PriceRejected"),
  event(sessionRiskControllerAbi, "SessionPosted"),
  event(corporateActionGuardAbi, "ActionPosted"),
  event(corporateActionGuardAbi, "ActionResolved"),
  event(corporateActionGuardAbi, "ActionCleared"),
  event(depthCapRegistryAbi, "CapPosted"),
  event(boundedLiquidatorAbi, "SliceExecuted"),
  event(boundedLiquidatorAbi, "SliceWaiting"),
  event(collateralMarketAbi, "LiquidationSettled"),
  event(collateralMarketAbi, "Borrowed"),
]

/** Order of PriceRelayAdapter.RejectReason: the first guard that failed. */
export const REJECT_REASONS = [
  "FutureFetch",
  "StaleFetch",
  "NotNewer",
  "UsdgStale",
  "UsdgOffPeg",
  "TwapUnavailable",
  "OutOfBand",
  "MaxMove",
] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

export const REJECT_TEXT: Record<RejectReason, string> = {
  FutureFetch: "The keeper's fetch time is in the future.",
  StaleFetch: "The keeper fetched the quote too long before posting it.",
  NotNewer: "The fetch is not newer than the last accepted post.",
  UsdgStale: "Chainlink USDG/USD is stale.",
  UsdgOffPeg: "USDG/USD is more than the peg limit away from $1.",
  TwapUnavailable: "The pool's 30-minute TWAP could not be read.",
  OutOfBand: "The implied wrapper price is outside the band around the pool TWAP.",
  MaxMove: "The move from the last accepted post is larger than the per-update limit.",
}

/** Where a row came from; `time` is the block timestamp (unix seconds) once known. */
export type LogRef = { tx: Hex; block: bigint; logIndex: number; address: Address; time: number | null }

export type PricePost = LogRef & {
  kind: "price"
  accepted: boolean
  reason: RejectReason | null
  quoteE18: bigint
  wrapperPriceE18: bigint
  /** 0 when the TWAP check was not reached (rejected earlier). */
  twapE18: bigint
  deviationBps: bigint
  /** Emitted on accepted posts only. */
  moveBps: bigint | null
  /** USDG/USD, 8 decimals; emitted on accepted posts only. */
  usdgAnswer: bigint | null
  fetchedAt: number
}
export type SessionPost = LogRef & { kind: "session"; session: Session; periodChangedAt: number; postedAt: number }
export type CapPost = LogRef & { kind: "cap"; market: Address; targetUsdg: bigint; sliceUsdg: bigint; effectiveUsdg: bigint }
export type ActionEvent = LogRef & {
  kind: "action"
  event: "posted" | "resolved" | "cleared"
  activationAt: number
  expectedMultiplier: bigint | null
  preActionMultiplier: bigint | null
  preActionPrice: bigint | null
  newMultiplier: bigint | null
  postActionPrice: bigint | null
}
export type Settlement = {
  keeper: Address
  proceeds: bigint
  repaid: bigint
  penalty: bigint
  surplus: bigint
  reserveCovered: bigint
  deficit: bigint
}
export type Slice = LogRef & {
  kind: "slice"
  executed: boolean
  market: Address
  borrower: Address
  session: Session
  sharesSold: bigint | null
  proceeds: bigint | null
  oraclePrice: bigint | null
  floorPrice: bigint
  settlement: Settlement | null
}
export type BorrowEvent = LogRef & { kind: "borrow"; market: Address; user: Address; amount: bigint; ltvAfterBps: bigint; maxLtvBps: bigint }

export type RiskRow = PricePost | SessionPost | CapPost | ActionEvent | Slice | BorrowEvent

/** The shape viem's getLogs returns when given `events`. */
export type DecodedLog = {
  eventName?: string
  args?: unknown
  address: Address
  transactionHash: Hex | null
  blockNumber: bigint | null
  logIndex: number | null
  blockTimestamp?: bigint | number | null
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export { watchedAddresses } from "@/lib/risk-logs/addresses"

export type MarketRows = {
  prices: PricePost[]
  sessions: SessionPost[]
  caps: CapPost[]
  actions: ActionEvent[]
  slices: Slice[]
  borrows: BorrowEvent[]
}

/**
 * Turns decoded logs into rows for one market, newest first. Shared contracts (session, caps, liquidator)
 * are filtered by the market they name. Liquidation settlements are joined to their slice by transaction.
 */
export function classify(logs: DecodedLog[], d: Deployment, m: MarketDeployment, times: Map<bigint, number>): MarketRows {
  const out: MarketRows = { prices: [], sessions: [], caps: [], actions: [], slices: [], borrows: [] }
  const settlements = new Map<string, Settlement>()
  for (const log of logs) {
    if (!log.eventName || !log.transactionHash || log.blockNumber === null) continue
    const a = (log.args ?? {}) as Record<string, unknown>
    const ref: LogRef = {
      tx: log.transactionHash,
      block: log.blockNumber,
      logIndex: log.logIndex ?? 0,
      address: log.address,
      time: times.get(log.blockNumber) ?? null,
    }
    const big = (k: string) => BigInt(a[k] as bigint | number)
    const num = (k: string) => Number(a[k] as bigint | number)
    const from = (addr: string) => same(log.address, addr)
    switch (log.eventName) {
      case "PricePosted":
      case "PriceRejected": {
        if (!from(m.priceRelay)) break
        const accepted = log.eventName === "PricePosted"
        out.prices.push({
          ...ref,
          kind: "price",
          accepted,
          reason: accepted ? null : (REJECT_REASONS[num("reason")] ?? null),
          quoteE18: big("quoteE18"),
          wrapperPriceE18: big("wrapperPriceE18"),
          twapE18: big("twapWrapperPriceE18"),
          deviationBps: big("deviationBps"),
          moveBps: accepted ? big("moveBps") : null,
          usdgAnswer: accepted ? big("usdgAnswer") : null,
          fetchedAt: num("fetchedAt"),
        })
        break
      }
      case "SessionPosted":
        if (!from(d.sessionRisk)) break
        out.sessions.push({ ...ref, kind: "session", session: sessionFromIndex(num("session")), periodChangedAt: num("periodChangedAt"), postedAt: num("postedAt") })
        break
      case "CapPosted":
        if (!from(d.depthCaps) || !same(String(a.market), m.market)) break
        out.caps.push({ ...ref, kind: "cap", market: a.market as Address, targetUsdg: big("targetCapUsdg"), sliceUsdg: big("sliceUsdg"), effectiveUsdg: big("effectiveCapUsdg") })
        break
      case "ActionPosted":
      case "ActionResolved":
      case "ActionCleared": {
        if (!from(m.corporateActionGuard)) break
        const posted = log.eventName === "ActionPosted"
        const resolved = log.eventName === "ActionResolved"
        out.actions.push({
          ...ref,
          kind: "action",
          event: posted ? "posted" : resolved ? "resolved" : "cleared",
          activationAt: num("activationAt"),
          expectedMultiplier: posted ? big("expectedMultiplier") : null,
          preActionMultiplier: posted ? big("preActionMultiplier") : null,
          preActionPrice: posted ? big("preActionPrice") : null,
          newMultiplier: resolved ? big("newMultiplier") : null,
          postActionPrice: resolved ? big("postActionPrice") : null,
        })
        break
      }
      case "SliceExecuted":
      case "SliceWaiting": {
        if (!from(d.liquidator) || !same(String(a.market), m.market)) break
        const executed = log.eventName === "SliceExecuted"
        out.slices.push({
          ...ref,
          kind: "slice",
          executed,
          market: a.market as Address,
          borrower: a.borrower as Address,
          session: sessionFromIndex(num("session")),
          sharesSold: executed ? big("sharesSold") : null,
          proceeds: executed ? big("proceeds") : null,
          oraclePrice: executed ? big("oraclePrice") : null,
          floorPrice: big("floorPrice"),
          settlement: null,
        })
        break
      }
      case "LiquidationSettled":
        if (!from(m.market)) break
        settlements.set(`${log.transactionHash}:${String(a.borrower).toLowerCase()}`, {
          keeper: a.keeper as Address,
          proceeds: big("proceeds"),
          repaid: big("repaid"),
          penalty: big("penalty"),
          surplus: big("surplus"),
          reserveCovered: big("reserveCovered"),
          deficit: big("deficit"),
        })
        break
      case "Borrowed":
        if (!from(m.market)) break
        out.borrows.push({ ...ref, kind: "borrow", market: log.address, user: a.user as Address, amount: big("amount"), ltvAfterBps: big("ltvAfterBps"), maxLtvBps: big("maxLtvBps") })
        break
    }
  }
  for (const s of out.slices) s.settlement = settlements.get(`${s.tx}:${s.borrower.toLowerCase()}`) ?? null
  const newestFirst = (x: LogRef, y: LogRef) => (x.block === y.block ? y.logIndex - x.logIndex : x.block > y.block ? -1 : 1)
  for (const list of Object.values(out) as LogRef[][]) list.sort(newestFirst)
  return out
}

/** Block ranges of at most `span` blocks covering [from, to], newest first. */
export function chunkRanges(from: bigint, to: bigint, span: bigint): { fromBlock: bigint; toBlock: bigint }[] {
  const out: { fromBlock: bigint; toBlock: bigint }[] = []
  for (let hi = to; hi >= from; hi -= span) {
    const lo = hi - span + 1n > from ? hi - span + 1n : from
    out.push({ fromBlock: lo, toBlock: hi })
    if (lo === from) break
  }
  return out
}
