/**
 * Intatto's own words for the Market screen: what each session means now, why each guard passes or fails,
 * and the one sentence that says what still works when new borrowing is refused.
 */
import { REFUSALS, type RefusalName, type Session } from "@intatto/config/session"
import type { MarketState } from "@/lib/chain"
import type { ProtocolParams, RelayDetail } from "./use-market-params"
import { ago, bpsShort, diffBps, duration, formatUtc, usdPrice } from "./format"

export const SESSION_LABEL: Record<Session, string> = {
  OPEN: "Open",
  EXTENDED: "Extended hours",
  CLOSED: "Closed",
  HALTED: "Halted",
  CORPORATE_ACTION: "Corporate action",
  UNKNOWN: "Unknown",
}

export type Tone = "success" | "warning" | "destructive" | "info"

export const SESSION_TONE: Record<Session, Tone> = {
  OPEN: "success",
  EXTENDED: "info",
  CLOSED: "warning",
  HALTED: "destructive",
  CORPORATE_ACTION: "destructive",
  UNKNOWN: "destructive",
}

/** What the session in force means for a borrower right now. */
export function sessionMeaning(s: MarketState, p: ProtocolParams, relay: RelayDetail | undefined, now: number): string {
  const bandOpen = relay ? ` The relayed price must stay within ±${bpsShort(relay.bandOpenBps)} of the pool's 30-minute average.` : ""
  const bandOther = relay ? ` The price band is ±${bpsShort(relay.bandOtherBps)}.` : ""
  switch (s.session) {
    case "OPEN":
      return `US regular trading hours. New loans can reach ${bpsShort(p.openLtvBps)} of collateral value.${bandOpen}`
    case "EXTENDED":
      return `Pre-market, after-hours or overnight trading. New loans can reach ${bpsShort(p.extendedLtvBps)} of collateral value.${bandOther}`
    case "CLOSED": {
      const elapsed = s.periodChangedAt > 0 ? ` It closed ${ago(now, s.periodChangedAt)}.` : ""
      return `The US stock market is closed. The limit for new loans steps down from ${bpsShort(p.closedStartBps)} to ${bpsShort(p.closedFloorBps)} over ${duration(p.closedDecaySeconds)} after the close.${elapsed}${bandOther}`
    }
    case "HALTED":
      return "Trading in this stock is halted. No new loans; repaying and adding collateral still work, and liquidations wait."
    case "CORPORATE_ACTION":
      return "A split or dividend is being applied. No new loans and no liquidations until it settles."
    case "UNKNOWN":
      return `The keeper has not posted a session in the last ${duration(p.sessionLivenessSeconds)}, so no new loans until it does.`
  }
}

/** Every reason a new borrow would be refused right now, in the order CollateralMarket.borrow checks them. */
export function refusalsFor(s: MarketState): RefusalName[] {
  const out: RefusalName[] = []
  if (s.issuerPaused) out.push("IssuerPaused")
  if (s.session === "UNKNOWN") out.push("UnknownSession")
  else if (s.maxLtvBps === 0n) out.push("SessionLimit")
  if (!s.fresh) out.push("StalePrice")
  if (!s.inBand) out.push("PriceOutOfBand")
  if (s.corporateActionPaused) out.push("CorporateActionPending")
  if (s.capUsdg <= s.totalDebt) out.push("TickerCapReached")
  if (!s.pegOk) out.push("UsdgOffPeg")
  return out
}

/** The contract's refusal in words, with the one case the generic text gets wrong: no price posted at all. */
export function refusalReason(name: RefusalName, s: MarketState): string {
  if (name === "StalePrice" && s.priceE18 === 0n) return "No price has been posted for this market yet, so new borrowing is off."
  return REFUSALS[name]
}

/** One sentence: why new borrowing is off, what is refused and what still works. */
export function pausedSentence(first: RefusalName, s: MarketState, symbol: string): string {
  const works = "repaying and adding collateral still work"
  switch (first) {
    case "IssuerPaused":
      return `The issuer has paused ${symbol}: new borrowing and liquidations are refused; repaying stays open.`
    case "UnknownSession":
      return `The keeper's session post is missing or too old: new borrowing and liquidations are refused; ${works}.`
    case "SessionLimit":
      return `The ${SESSION_LABEL[s.session].toLowerCase()} session allows no new borrowing and liquidations wait; ${works}.`
    case "StalePrice":
      return `The keeper's last price is too old: new borrowing, liquidations and withdrawals that leave debt are refused; ${works}.`
    case "PriceOutOfBand":
      return `The relayed price is outside the band around the pool's 30-minute average: new borrowing is refused; ${works}.`
    case "CorporateActionPending":
      return `A split or dividend is activating for ${symbol}: new borrowing and liquidations are paused until it settles; ${works}.`
    case "TickerCapReached":
      return `Debt against ${symbol} has reached its cap: new borrowing is refused until loans are repaid or the cap grows; ${works}.`
    case "UsdgOffPeg":
      return `USDG/USD is stale or more than 1% off $1: new borrowing is refused; ${works}.`
    default:
      return `${REFUSALS[first]} ${works[0]!.toUpperCase()}${works.slice(1)}.`
  }
}

export type GuardKey = "fresh" | "inBand" | "pegOk" | "corporateAction" | "issuerPause"

export type GuardResult = { key: GuardKey; label: string; ok: boolean; reason: string }

/** The five checks every new borrow passes, each with a one-line reason. */
export function guardResults(
  s: MarketState,
  relay: RelayDetail | undefined,
  now: number,
  symbol: string,
  relayFailed = false,
): GuardResult[] {
  const unread = relayFailed ? "The relay's inputs could not be read from the RPC." : "Reading the relay's inputs…"
  const noPrice = s.priceE18 === 0n
  const liveness = relay ? ` (limit ${duration(relay.priceLivenessSeconds)})` : ""
  const fresh = noPrice
    ? "No price has been posted yet."
    : s.fresh
      ? `The keeper posted ${ago(now, s.fetchedAt)}${liveness}.`
      : `The keeper's last post was ${ago(now, s.fetchedAt)}, past its liveness limit${liveness}.`

  let band = unread
  if (noPrice) band = "No price to compare with the pool yet."
  else if (relay && relay.twapOk) {
    const width = s.session === "OPEN" ? relay.bandOpenBps : relay.bandOtherBps
    const dev = Math.abs(diffBps(relay.impliedE18, relay.twapE18)) / 100
    band = `Implied w${symbol} price ${usdPrice(relay.impliedE18)} is ${dev.toFixed(2)}% from the pool's 30-min TWAP ${usdPrice(relay.twapE18)}; ${s.inBand ? "inside" : "outside"} ±${bpsShort(width)}.`
  } else if (relay && !relay.twapOk) band = "The pool cannot supply a 30-minute TWAP right now."

  let peg = unread
  if (relay) {
    const answer = (Number(relay.usdgAnswerE8) / 1e8).toFixed(4)
    const when = relay.usdgUpdatedAt > 0 ? `, updated ${formatUtc(relay.usdgUpdatedAt)}` : ""
    peg = s.pegOk
      ? `Chainlink USDG/USD reads $${answer}, within ${bpsShort(relay.pegBps)} of $1${when}.`
      : `Chainlink USDG/USD reads $${answer}${when}: stale or more than ${bpsShort(relay.pegBps)} off $1.`
  }

  return [
    { key: "fresh", label: "Fresh price", ok: s.fresh, reason: fresh },
    { key: "inBand", label: "In band", ok: s.inBand, reason: band },
    { key: "pegOk", label: "USDG peg", ok: s.pegOk, reason: peg },
    {
      key: "corporateAction",
      label: "Corporate action",
      ok: !s.corporateActionPaused,
      reason: s.corporateActionPaused
        ? "A split or dividend is activating; borrowing and liquidation are paused."
        : "No split or dividend is activating.",
    },
    {
      key: "issuerPause",
      label: "Issuer pause",
      ok: !s.issuerPaused,
      reason: s.issuerPaused ? REFUSALS.IssuerPaused : `The issuer has not paused ${symbol} or its wrapper.`,
    },
  ]
}

export const RELAY_TOOLTIP =
  "Relay: keeper relays the xStocks issuer's indicative quote — trusted relayer, bounded onchain by keeper liveness, the pool's 30-minute TWAP band, a max move per update and the USDG/USD peg."

/** The layered price in words: quote, then the pool TWAP check, then the USDG/USD conversion. */
export function priceLayers(s: MarketState, relay: RelayDetail, symbol: string): string[] {
  const band = `±${bpsShort(relay.bandOpenBps)} while open, ±${bpsShort(relay.bandOtherBps)} otherwise`
  return [
    `The keeper relays the issuer's indicative ${symbol}/USD quote: ${usdPrice(s.priceE18)}, fetched by the keeper at ${formatUtc(s.fetchedAt)}. The quote has no source timestamp.`,
    `Checked against the w${symbol}/USDG pool's 30-minute TWAP (${band}); a post that moves more than ${bpsShort(relay.maxMoveBps)} from the last one is rejected.`,
    `USDG is converted with Chainlink USDG/USD, which must be recent and within ${bpsShort(relay.pegBps)} of $1.`,
  ]
}
