/**
 * Named scenarios on a fork of X Layer mainnet. Portable (viem only): the local harness, the checks and the
 * hosted sandbox all run these. Prices are counterfactual paths applied to the CURRENT fork price; a simulated
 * arbitrageur moves the real pool first so the relay's TWAP band admits the post, exactly as it would on mainnet.
 */
import { maxUint256, type Address, type Hex } from "viem"
import { TICKERS } from "@intatto/config/xlayer"
import type { Deployment } from "@intatto/config/deployments"
import * as abi from "./abis.ts"
import type { ForkChain } from "./chain.ts"
import { arbitrageDown, fund, ForkKeeper, HOLDER, poolImpliedQuote } from "./actors.ts"
import { calendarSession, mondayOpenAfter, nextOpen, nextWeekendClose, MINUTE } from "./clock.ts"

export type GapReplay = {
  id: string
  label: string
  anchors: { fridayClose: { t: number; c: number }; mondayOpen: { t: number; o: number } }
  bars: { t: number; o: number; h: number; l: number; c: number }[]
  sources?: { url: string; retrievedAt: string; sha256: string }[]
}
export type SyntheticGap = { id: string; label: string; gapBps: number }

export type ScenarioContext = {
  fork: ForkChain
  d: Deployment
  keeper: ForkKeeper
  /** Accounts the keeper checks for liquidation after a price move. */
  watch: Address[]
}

export function context(fork: ForkChain, d: Deployment, watch: Address[] = []): ScenarioContext {
  return { fork, d, keeper: new ForkKeeper(fork, d), watch }
}

const nvda = (ctx: ScenarioContext) => ctx.d.markets.find((m) => m.symbol === "NVDAx")!

/** Posts the calendar session and the pool-implied quote, as the keeper would each minute. */
export async function keeperTick(ctx: ScenarioContext, quote?: bigint) {
  const now = await ctx.fork.chainTime()
  const { session, periodChangedAt } = calendarSession(now)
  await ctx.keeper.session(session, periodChangedAt)
  return ctx.keeper.price(quote ?? (await poolImpliedQuote(ctx.fork)))
}

/** Funds `who` from the real holder and opens a position at `ltvBps` of the current session limit's value. */
export async function openPosition(ctx: ScenarioContext, who: Address, nvdax: bigint, ltvBps: number) {
  const m = nvda(ctx)
  await fund(ctx.fork, who, { okb: 10n ** 17n, nvdax })
  await ctx.fork.write(who, m.token as Address, abi.erc20, "approve", [m.market, maxUint256])
  await ctx.fork.write(who, m.market as Address, abi.market, "addCollateral", [nvdax])
  const [quote] = await ctx.fork.read<[bigint, bigint]>(m.priceRelay as Address, abi.priceRelay, "latestPrice")
  const assets = await ctx.fork.read<bigint>(m.wrapper as Address, abi.wrapper, "convertToAssets", [
    (await ctx.fork.read<[bigint, bigint]>(m.market as Address, abi.market, "positionOf", [who]))[0],
  ])
  const valueUsdg = (assets * quote) / 10n ** 30n
  // Never above the session in force: stay 50 bps under its max new-borrow LTV.
  const maxLtv = Number(await ctx.fork.read<bigint>(ctx.d.sessionRisk as Address, abi.sessionRisk, "maxLtvBps"))
  const borrow = (valueUsdg * BigInt(Math.min(ltvBps, maxLtv - 50))) / 10_000n
  const hash = await ctx.fork.write(who, m.market as Address, abi.market, "borrow", [borrow])
  await ctx.fork.ledger.add({ kind: "scenario", summary: `scenario borrower ${who} opened ${ltvBps / 100}% LTV`, txHash: hash, chainTime: await ctx.fork.chainTime() })
  if (!ctx.watch.includes(who)) ctx.watch.push(who)
  return borrow
}

/** Moves to regular trading hours if needed (the only session with the 50% weekday limit) and posts a tick. */
export async function ensureOpen(ctx: ScenarioContext) {
  const now = await ctx.fork.chainTime()
  const open = nextOpen(now)
  if (open > now) await ctx.fork.warpTo(open + MINUTE, "move to regular US trading hours")
  return keeperTick(ctx)
}

/** A scenario borrower at the weekday (OPEN) limit, as a borrower would sit going into a weekend. */
export async function openAtWeekdayLimit(ctx: ScenarioContext, who: Address, nvdax: bigint) {
  await ensureOpen(ctx)
  return openPosition(ctx, who, nvdax, 5000)
}

/** Jump to Saturday: warp past the next weekend close; the keeper posts CLOSED and a fresh price. */
export async function weekend(ctx: ScenarioContext) {
  const close = nextWeekendClose(await ctx.fork.chainTime())
  await ctx.fork.warpTo(close + 12 * 3600, "jump to Saturday 12:00 UTC (market closed)")
  await keeperTick(ctx)
  return { close }
}

/** Liquidates every watched account the market says is liquidatable; returns executed slice tx hashes. */
export async function liquidateWatched(ctx: ScenarioContext, maxSlices = 6): Promise<Hex[]> {
  const m = nvda(ctx)
  const hashes: Hex[] = []
  for (const who of ctx.watch) {
    for (let i = 0; i < maxSlices; i++) {
      const liquidatable = await ctx.fork.read<boolean>(m.market as Address, abi.market, "isLiquidatable", [who])
      if (!liquidatable) break
      hashes.push(await ctx.keeper.liquidate(who))
    }
  }
  return hashes
}

/** Moves the pool and the relayed price down by `totalBps` in steps the relay's max-move and TWAP band admit. */
export async function stepDown(ctx: ScenarioContext, totalBps: number, why: string, stepBps = 1400) {
  let remaining = 1 - totalBps / 10_000
  while (remaining < 0.9999) {
    const step = Math.max(1 - stepBps / 10_000, remaining)
    await arbitrageDown(ctx.fork, Math.round((1 - step) * 10_000))
    remaining /= step
    await ctx.fork.warpBy(31 * MINUTE, `${why}: let the 30-minute TWAP settle`)
    const { accepted } = await keeperTick(ctx)
    if (!accepted) throw new Error(`relay rejected the ${why} step`)
  }
}

/**
 * Replays the 24–27 Jan 2025 NVDA weekend gap (CFD counterfactual prices, not historical X Layer liquidity):
 * Friday close → weekend CLOSED → Monday open gap → Monday close, scaled onto the current fork price.
 */
export async function gapReplay(ctx: ScenarioContext, replay: GapReplay) {
  const fri = replay.anchors.fridayClose.c
  const monOpen = replay.anchors.mondayOpen.o
  const monClose = replay.bars[replay.bars.length - 1].c
  await ctx.fork.ledger.add({ kind: "scenario", summary: `replay ${replay.id}: ${replay.label}`, detail: { sources: replay.sources }, chainTime: await ctx.fork.chainTime() })
  const { close } = await weekend(ctx)
  const waiting = await liquidateWatched(ctx) // CLOSED: only floor-bounded slices may execute
  await ctx.fork.warpTo(mondayOpenAfter(close), "Monday open")
  const openBps = Math.round((1 - monOpen / fri) * 10_000)
  await stepDown(ctx, openBps, "Monday open gap")
  const opened = await liquidateWatched(ctx)
  const closeBps = Math.round((1 - monClose / monOpen) * 10_000)
  await ctx.fork.warpBy(6 * 3600, "Monday afternoon")
  await stepDown(ctx, closeBps, "Monday close")
  const later = await liquidateWatched(ctx)
  return { openGapBps: openBps, closeMoveBps: closeBps, slices: [...waiting, ...opened, ...later] }
}

/** A synthetic gap larger than the reserve (not market data): liquidation, reserve, then a lender deficit. */
export async function syntheticGap(ctx: ScenarioContext, gap: SyntheticGap) {
  await ctx.fork.ledger.add({ kind: "scenario", summary: `replay ${gap.id}: ${gap.label}`, chainTime: await ctx.fork.chainTime() })
  await keeperTick(ctx)
  await stepDown(ctx, gap.gapBps, "synthetic gap")
  const slices = await liquidateWatched(ctx, 12)
  return { slices }
}

/**
 * Corporate action: the issuer's real multiplier updater (impersonated on the fork — recorded as a simulated
 * issuer action) schedules a 10-for-1 multiplier change; the keeper posts the pending action.
 */
export async function corporateAction(ctx: ScenarioContext, ratio = 10n, leadMinutes = 20) {
  const t = TICKERS.NVDAx
  const updater = await ctx.fork.read<Address>(t.token, abi.xstock, "multiplierUpdater")
  const [current] = await ctx.fork.read<[bigint, bigint, bigint]>(t.token, abi.xstock, "getCurrentMultiplier")
  const activationAt = (await ctx.fork.chainTime()) + leadMinutes * MINUTE
  const hash = await ctx.fork.write(updater, t.token, abi.xstock, "updateMultiplierValue", [current * ratio, current, BigInt(activationAt)])
  await ctx.fork.ledger.add({
    kind: "actor",
    summary: `simulated issuer action: multiplier updater ${updater} scheduled ${ratio}-for-1 (multiplier ${current} → ${current * ratio})`,
    txHash: hash,
    chainTime: await ctx.fork.chainTime(),
  })
  await ctx.keeper.action(activationAt, current * ratio)
  return { activationAt, before: current, after: current * ratio }
}

/** Moves past activation and posts the post-split quote (divided by the ratio: consistent with the multiplier). */
export async function activateCorporateAction(ctx: ScenarioContext, activationAt: number, ratio = 10n, consistent = true) {
  const now = await ctx.fork.chainTime()
  if (now <= activationAt) await ctx.fork.warpTo(activationAt + 60, "past the multiplier activation")
  const m = nvda(ctx)
  const [quote] = await ctx.fork.read<[bigint, bigint]>(m.priceRelay as Address, abi.priceRelay, "latestPrice")
  const { session, periodChangedAt } = calendarSession(await ctx.fork.chainTime())
  await ctx.keeper.session(session, periodChangedAt)
  const posted = await ctx.keeper.price(consistent ? quote / ratio : quote)
  const guard = m.corporateActionGuard as Address
  const paused = await ctx.fork.read<boolean>(guard, abi.corporateAction, "isPaused")
  if (!paused) await ctx.fork.write(ctx.d.keeper as Address, guard, abi.corporateAction, "resolve")
  return { accepted: posted.accepted, paused }
}

export { HOLDER }
