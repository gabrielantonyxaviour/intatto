/**
 * One keeper cycle (portable: viem only; the Worker, checks and sandbox all call it).
 *   1. read the issuer per market; an error logs `backoff` and that market posts nothing
 *   2. never post from inputs that disagree (no quote, contradictory halt flags, quote outside the relay's
 *      band around the pool's 30-minute TWAP) → `skipped` with the reason
 *   3. session (global; from the first market) when it changed or the last post is older than 10 minutes
 *   4. price when it moved >0.1% or the last post is older than 5 minutes; simulated first, a would-be rejection
 *      is logged and only sent with sendRejected
 *   5. a pending corporate action, once, while it is still in the future
 *   6. the depth cap when it changed >5% or is older than an hour
 *   7. one liquidation slice per liquidatable borrower found in Borrowed events
 */
import type { Address } from "viem"
import { sessionFromIndex, type Session } from "@intatto/config/session"
import type { MarketDeployment } from "@intatto/config/deployments"
import { sessionRiskControllerAbi } from "./abi.ts"
import { read, shortError, withRetry } from "./chain.ts"
import { DEFAULT_OPTIONS, type CycleDeps, type StepContext } from "./context.ts"
import { IssuerError } from "./issuer.ts"
import type { IssuerReading } from "./issuer-parse.ts"
import { bandCheck, postPrice, postSession } from "./steps/price.ts"
import { postPendingAction } from "./steps/action.ts"
import { postDepthCap } from "./steps/depth.ts"
import { liquidateUnhealthy } from "./steps/liquidations.ts"
import { MemoryState, type KeeperAction } from "./types.ts"

export { DEFAULT_OPTIONS, type CycleDeps, type CycleOptions } from "./context.ts"

export type CycleResult = {
  /** ISO time of the cycle (the keeper clock at its start). */
  at: string
  chainTime: number
  actions: KeeperAction[]
  /** Steps that failed on RPC after retries (each also logged as `skipped`). */
  failures: number
}

export async function runCycle(deps: CycleDeps): Promise<CycleResult> {
  const t = deps.now()
  const at = new Date(t * 1000).toISOString()
  const actions: KeeperAction[] = []
  const block = await withRetry(() => deps.publicClient.getBlock({ blockTag: "latest" }))
  const ctx: StepContext = {
    publicClient: deps.publicClient,
    walletClient: deps.walletClient,
    deployment: deps.deployment,
    state: deps.state ?? new MemoryState(),
    o: { ...DEFAULT_OPTIONS, ...deps.options },
    t,
    chainTime: Number(block.timestamp),
    log: async (a) => {
      const entry = { at, ...a }
      actions.push(entry)
      await deps.log(entry)
    },
  }
  let failures = 0
  const step = async (market: MarketDeployment["symbol"], name: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      failures++
      await ctx.log({ market, kind: "skipped", detail: `${name} step failed after retries, next cycle retries: ${shortError(e)}` })
    }
  }

  // 1. issuer inputs
  const readings = new Map<MarketDeployment["symbol"], IssuerReading>()
  for (const m of deps.deployment.markets) {
    try {
      readings.set(m.symbol, await deps.issuer.read(m.symbol, deps.now))
    } catch (e) {
      const ie = e instanceof IssuerError ? e : null
      await ctx.log({
        market: m.symbol,
        kind: "backoff",
        detail: `issuer read failed (${ie?.message ?? shortError(e)}); posting nothing for ${m.symbol} this cycle`,
        data: { code: ie?.code ?? "unknown", status: ie?.status ?? null, retryAt: ie?.retryAt ?? null },
      })
    }
  }

  // 2. agreement: the band follows the session that will be in force when the price lands
  const primary = deps.deployment.markets[0]
  const onchainSession = async (): Promise<Session> =>
    sessionFromIndex(Number(await read<number>(ctx, { address: deps.deployment.sessionRisk as Address, abi: sessionRiskControllerAbi, functionName: "currentSession" })))
  const usable = new Map<MarketDeployment["symbol"], IssuerReading>()
  let bandSession: Session | null = null
  for (const m of deps.deployment.markets) {
    const r = readings.get(m.symbol)
    if (!r) continue
    await step(m.symbol, "input check", async () => {
      const why = r.disagreement ?? (await bandCheck(ctx, m, r, m === primary ? r.session : (bandSession ?? (await onchainSession()))))
      if (why) {
        await ctx.log({ market: m.symbol, kind: "skipped", detail: `issuer inputs disagree, nothing posted from them: ${why}`, data: { period: r.period, halted: r.halted } })
        return
      }
      usable.set(m.symbol, r)
      if (m === primary) bandSession = r.session
    })
  }

  // 3. session (one controller for every market)
  const primaryReading = usable.get(primary.symbol)
  if (primaryReading) await step(primary.symbol, "session", () => postSession(ctx, primaryReading, primary.symbol))

  // 4–7 per market
  for (const m of deps.deployment.markets) {
    const r = usable.get(m.symbol)
    const answered = readings.has(m.symbol)
    if (r) await step(m.symbol, "price", async () => postPrice(ctx, m, r, bandSession ?? (await onchainSession())))
    if (answered) {
      await step(m.symbol, "corporate action", () => postPendingAction(ctx, m, r?.pendingAction))
      await step(m.symbol, "depth cap", () => postDepthCap(ctx, m))
    }
    await step(m.symbol, "liquidation", () => liquidateUnhealthy(ctx, m))
  }
  return { at, chainTime: ctx.chainTime, actions, failures }
}
