/**
 * Session and price posts. The session is global (one SessionRiskController); the price is per market relay.
 * Nothing is posted from inputs that disagree: the cycle calls bandCheck first.
 */
import { formatUnits, type Address } from "viem"
import { sessionFromIndex, sessionIndex, type Session } from "@intatto/config/session"
import type { MarketDeployment } from "@intatto/config/deployments"
import { priceRelayAdapterAbi, sessionRiskControllerAbi, wrapperAbi } from "../abi.ts"
import { diffBpsCeil, read, sendCall, simulate } from "../chain.ts"
import type { StepContext } from "../context.ts"
import type { IssuerReading } from "../issuer-parse.ts"

const REJECT_REASONS = ["FutureFetch", "StaleFetch", "NotNewer", "UsdgStale", "UsdgOffPeg", "TwapUnavailable", "OutOfBand", "MaxMove"] as const

const usd = (e18: bigint) => `$${Number(formatUnits(e18, 18)).toFixed(4)}`

async function wrapperPrice(ctx: StepContext, m: MarketDeployment, quoteE18: bigint) {
  const assetsPerShare = await read<bigint>(ctx, { address: m.wrapper as Address, abi: wrapperAbi, functionName: "convertToAssets", args: [10n ** 18n] })
  return (quoteE18 * assetsPerShare) / 10n ** 18n
}

async function bandFor(ctx: StepContext, m: MarketDeployment, session: Session): Promise<bigint> {
  const relay = { address: m.priceRelay as Address, abi: priceRelayAdapterAbi }
  return read<bigint>(ctx, { ...relay, functionName: session === "OPEN" ? "bandOpenBps" : "bandOtherBps" })
}

/**
 * Null when the quote sits inside the relay's band around the pool's 30-minute TWAP for `session`, else the
 * reason it does not. An unavailable TWAP is left to the relay's own simulation (reported as TwapUnavailable).
 */
export async function bandCheck(ctx: StepContext, m: MarketDeployment, r: IssuerReading, session: Session): Promise<string | null> {
  if (r.quoteE18 === null) return "the issuer returned no quote"
  const [ok, twap] = await read<[boolean, bigint]>(ctx, { address: m.priceRelay as Address, abi: priceRelayAdapterAbi, functionName: "twapWrapperPrice" })
  if (!ok || twap === 0n) return null
  const implied = await wrapperPrice(ctx, m, r.quoteE18)
  const band = await bandFor(ctx, m, session)
  const dev = diffBpsCeil(implied, twap)
  if (dev <= band) return null
  return `issuer quote ${usd(r.quoteE18)} implies ${usd(implied)} per wrapper share, ${dev} bps from the pool's 30-minute TWAP ${usd(twap)} (band ${band} bps in ${session})`
}

/** Posts the session when it changed or the last post is older than sessionMaxAgeSec. */
export async function postSession(ctx: StepContext, r: IssuerReading, market: MarketDeployment["symbol"]) {
  const controller = { address: ctx.deployment.sessionRisk as Address, abi: sessionRiskControllerAbi }
  const [last, lastChangedAt, postedAt] = await read<[number, bigint, bigint]>(ctx, { ...controller, functionName: "lastPost" })
  const next = sessionIndex(r.session)
  const changed = Number(last) !== next
  const age = ctx.chainTime - Number(postedAt) // liveness is block time, like the contract
  if (!changed && age < ctx.o.sessionMaxAgeSec) return
  // An unchanged session keeps its period start, so a CLOSED decay never restarts on a refresh.
  const periodChangedAt = Math.min(!changed && lastChangedAt > 0n ? Number(lastChangedAt) : r.periodChangedAt, ctx.chainTime)
  const call = { ...controller, functionName: "postSession", args: [next, BigInt(periodChangedAt)] }
  await simulate(ctx, call)
  const { hash } = await sendCall(ctx, call)
  await ctx.log({
    market,
    kind: "session",
    detail: changed
      ? `posted session ${r.session} (was ${sessionFromIndex(Number(last))}); issuer period "${r.period}"`
      : `refreshed session ${r.session} (last post ${Math.round(age / 60)} min old)`,
    data: { session: r.session, periodChangedAt, issuerPeriod: r.period, halted: r.halted },
    txHash: hash,
  })
}

/** The first relay guard `post(quote, fetchedAt)` would fail, read the same way the relay evaluates it. */
async function explainRejection(ctx: StepContext, m: MarketDeployment, quoteE18: bigint, fetchedAt: number, session: Session) {
  const relay = { address: m.priceRelay as Address, abi: priceRelayAdapterAbi }
  const [maxFetchAge, [, lastFetchedAt], [answer, updatedAt, usdgOk], usdgMaxAge, [twapOk, twap], lastWrapper, maxMove] = await Promise.all([
    read<bigint>(ctx, { ...relay, functionName: "maxFetchAge" }),
    read<[bigint, bigint]>(ctx, { ...relay, functionName: "latestPrice" }),
    read<[bigint, bigint, boolean]>(ctx, { ...relay, functionName: "usdgStatus" }),
    read<bigint>(ctx, { ...relay, functionName: "usdgMaxAge" }),
    read<[boolean, bigint]>(ctx, { ...relay, functionName: "twapWrapperPrice" }),
    read<bigint>(ctx, { ...relay, functionName: "lastWrapperPrice" }),
    read<bigint>(ctx, { ...relay, functionName: "maxMoveBps" }),
  ])
  const now = BigInt(ctx.chainTime)
  const at = BigInt(fetchedAt)
  let reason: (typeof REJECT_REASONS)[number] | "Unexplained" = "Unexplained"
  let note = ""
  const implied = await wrapperPrice(ctx, m, quoteE18)
  if (at > now) reason = "FutureFetch"
  else if (now - at > maxFetchAge) reason = "StaleFetch"
  else if (at <= lastFetchedAt) reason = "NotNewer"
  else if (!usdgOk) reason = answer <= 0n || updatedAt === 0n || now - updatedAt > usdgMaxAge ? "UsdgStale" : "UsdgOffPeg"
  else if (!twapOk || twap === 0n) reason = "TwapUnavailable"
  else if (diffBpsCeil(implied, twap) > (await bandFor(ctx, m, session))) {
    reason = "OutOfBand"
    note = `${diffBpsCeil(implied, twap)} bps from the TWAP`
  } else if (lastWrapper !== 0n && diffBpsCeil(implied, lastWrapper) > maxMove) {
    reason = "MaxMove"
    note = `${diffBpsCeil(implied, lastWrapper)} bps from the last accepted post`
  }
  return { reason, note }
}

/** Posts the price when it moved more than priceMoveBps or the last post is older than priceMaxAgeSec. */
export async function postPrice(ctx: StepContext, m: MarketDeployment, r: IssuerReading, session: Session) {
  if (r.quoteE18 === null) return
  const relay = { address: m.priceRelay as Address, abi: priceRelayAdapterAbi }
  const [lastQuote, lastFetchedAt] = await read<[bigint, bigint]>(ctx, { ...relay, functionName: "latestPrice" })
  const moved = lastQuote === 0n ? null : diffBpsCeil(r.quoteE18, lastQuote)
  const age = ctx.chainTime - Number(lastFetchedAt)
  if (moved !== null && moved <= BigInt(ctx.o.priceMoveBps) && age < ctx.o.priceMaxAgeSec) return
  // Never ahead of the chain: a keeper clock a second fast must not trip FutureFetch.
  const fetchedAt = Math.min(r.fetchedAt, ctx.chainTime)
  const call = { ...relay, functionName: "post", args: [r.quoteE18, BigInt(fetchedAt)] }
  const accepted = await simulate<boolean>(ctx, call)
  const data = { quoteE18: r.quoteE18.toString(), fetchedAt, sourceTimestamp: 0, movedBps: moved === null ? null : Number(moved) }
  if (!accepted) {
    const { reason, note } = await explainRejection(ctx, m, r.quoteE18, fetchedAt, session)
    const why = `relay would reject ${usd(r.quoteE18)}: ${reason}${note ? ` (${note})` : ""}`
    if (!ctx.o.sendRejected) {
      await ctx.log({ market: m.symbol, kind: "price-rejected", detail: `${why}; not sent`, data: { ...data, reason } })
      return
    }
    const { hash } = await sendCall(ctx, call)
    await ctx.log({ market: m.symbol, kind: "price-rejected", detail: `${why}; sent so the relay records it`, data: { ...data, reason }, txHash: hash })
    return
  }
  const { hash } = await sendCall(ctx, call)
  await ctx.log({
    market: m.symbol,
    kind: "price",
    detail: `posted ${usd(r.quoteE18)} (${moved === null ? "first post" : `moved ${moved} bps, last post ${Math.round(age)} s old`})`,
    data,
    txHash: hash,
  })
}
