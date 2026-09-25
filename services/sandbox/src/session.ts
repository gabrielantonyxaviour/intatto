/**
 * One judge's sandbox session on a fork of X Layer mainnet: a funded burner, time travel, named scenarios and a
 * reset, all driven through the shared fork harness pieces (viem only, so it runs in a Durable Object as well as
 * in Node). Every admin call and its result is written to the divergence ledger through the injected sink.
 */
import { createPublicClient, http, type Address, type Chain, type PublicClient } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { xLayer } from "viem/chains"
import type { Deployment } from "@intatto/config/deployments"
import { sessionFromIndex } from "@intatto/config/session"
import * as abi from "../../../checks/fork/lib/abis.ts"
import { ForkChain, Ledger, type LedgerEntry } from "../../../checks/fork/lib/chain.ts"
import { fund, poolImpliedQuote } from "../../../checks/fork/lib/actors.ts"
import * as sc from "../../../checks/fork/lib/scenarios.ts"
import { human, iso, MAX_CLOCK_LEAD, nextMondayOpen } from "./clock.ts"
import { corporateActionData, gapReplay, PROVENANCE, syntheticGap } from "./replays.ts"
import { SandboxError, type ChainStatus, type SandboxSessionState, type ScenarioName, type WarpTarget } from "./types.ts"

/** What every session burner receives from the real holder (moved by impersonation, never minted). */
export const BURNER_FUNDS = { okb: 10n ** 17n, nvdax: 10n * 10n ** 18n, spyx: 2n * 10n ** 18n, usdg: 1_000n * 10n ** 6n }
/** The keyless scenario borrower whose 49% LTV position the gap scenarios liquidate. */
export const SCENARIO_BORROWER: Address = "0x0000000000000000000000000000000000005Ce7"
const KEEPER_STALE_MS = 10 * 60_000

export type SandboxSessionOptions = {
  adminRpcUrl: string
  /** Where the admin URL is not reachable with the global fetch (the Worker reaches its container through a Durable Object). */
  fetchFn?: typeof fetch
  chainId: number
  forkBlock: number
  deployment: Deployment
  sink: (entry: LedgerEntry) => void | Promise<void>
  state?: SandboxSessionState
  /** Wall clock in ms (injectable for tests). */
  now?: () => number
}

/** ForkChain whose viem client can use an injected fetch; everything else is the shared implementation. */
class SessionChain extends ForkChain {
  constructor(rpcUrl: string, chainId: number, ledger: Ledger, fetchFn?: typeof fetch) {
    super(rpcUrl, chainId, ledger)
    if (fetchFn) {
      const chain = { ...xLayer, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } } as Chain
      const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 120_000, fetchFn }) }) as PublicClient
      ;(this as { client: PublicClient }).client = client
    }
  }
}

export class SandboxSession {
  readonly fork: ForkChain
  readonly ctx: sc.ScenarioContext
  readonly state: SandboxSessionState
  private readonly now: () => number

  constructor(private opts: SandboxSessionOptions) {
    this.now = opts.now ?? Date.now
    this.state = structuredClone(opts.state ?? { watch: [] })
    this.fork = new SessionChain(opts.adminRpcUrl, opts.chainId, new Ledger(opts.sink), opts.fetchFn)
    // The context shares the state's watch array, so openPosition's additions persist with the state.
    this.ctx = sc.context(this.fork, opts.deployment, this.state.watch)
  }

  /** Sets the clock, refreshes the keeper, funds a fresh burner and takes the snapshot reset() returns to. */
  async start(): Promise<{ burnerKey: `0x${string}`; burnerAddress: Address }> {
    const now = Math.floor(this.now() / 1000)
    const from = await this.fork.chainTime()
    const capped = now > from + MAX_CLOCK_LEAD
    const target = Math.max(from + 1, Math.min(now, from + MAX_CLOCK_LEAD))
    await this.fork.warpTo(
      target,
      capped
        ? `session clock set to ${iso(target)}: the snapshot (${iso(from)}) is over 14 days old, so the clock stops 14 days after it to keep the forked USDG/USD feed inside its widened 30-day limit; rebuild the snapshot`
        : `session clock set to the wall clock (${iso(target)}); the snapshot was taken at ${iso(from)}`,
    )
    await this.refreshKeeper()
    const burnerKey = generatePrivateKey()
    const burnerAddress = privateKeyToAccount(burnerKey).address
    await fund(this.fork, burnerAddress, BURNER_FUNDS)
    this.state.burnerAddress = burnerAddress
    if (!this.state.watch.includes(burnerAddress)) this.state.watch.push(burnerAddress)
    this.state.snapshotId = await this.fork.snapshot()
    return { burnerKey, burnerAddress }
  }

  /** The keeper's minute tick: the calendar session and pool-implied quotes for every market. */
  async refreshKeeper() {
    await sc.keeperTick(this.ctx)
    await this.postSpyx()
    this.state.keeperAt = this.now()
  }

  /** Refreshes the keeper when its last posts are older than 10 minutes (contract liveness is 30). */
  async freshen(): Promise<boolean> {
    if (this.state.keeperAt && this.now() - this.state.keeperAt < KEEPER_STALE_MS) return false
    await this.refreshKeeper()
    return true
  }

  private async postSpyx() {
    if (!this.opts.deployment.markets.some((m) => m.symbol === "SPYx")) return
    await this.ctx.keeper.price(await poolImpliedQuote(this.fork, "SPYx"), "SPYx")
  }

  async warp(target: WarpTarget) {
    if (target === "saturday") {
      await sc.weekend(this.ctx)
      await this.postSpyx()
      this.state.keeperAt = this.now()
      return
    }
    if (target === "monday") {
      const open = nextMondayOpen(await this.fork.chainTime())
      await this.fork.warpTo(open + 60, `jump to Monday 09:30 ET, the regular session open (${iso(open)})`)
    } else {
      await this.fork.warpBy(target.seconds, `advance the clock by ${human(target.seconds)}`)
    }
    await this.refreshKeeper()
  }

  async scenario(name: ScenarioName) {
    await this.freshen()
    const t = () => this.fork.chainTime()
    switch (name) {
      case "corporate-action":
        return this.scheduleAction()
      case "corporate-action-activate": {
        if (!this.state.pendingAction) await this.scheduleAction()
        const { activationAt, ratio } = this.state.pendingAction!
        const r = await sc.activateCorporateAction(this.ctx, activationAt, BigInt(ratio))
        this.state.pendingAction = undefined
        await this.postSpyx()
        this.state.keeperAt = this.now()
        await this.fork.ledger.add({
          kind: "scenario",
          summary: `corporate action activated: the keeper posted the post-split quote (${r.accepted ? "accepted" : "rejected by the relay"}); the guard ${r.paused ? "is still paused" : "resolved and borrowing reopened"}`,
          detail: { ...PROVENANCE.corporateAction, accepted: r.accepted, paused: r.paused },
          chainTime: await t(),
        })
        return
      }
      case "gap-2025-01": {
        await this.fork.ledger.add({ kind: "scenario", summary: `scenario gap-2025-01 started: ${gapReplay.label}`, detail: { ...PROVENANCE.gap }, chainTime: await t() })
        await this.ensureScenarioBorrower()
        const r = await sc.gapReplay(this.ctx, gapReplay)
        await this.afterPriceScenario()
        await this.fork.ledger.add({
          kind: "scenario",
          summary: `gap replay finished: Monday open gap ${r.openGapBps / 100}%, then ${r.closeMoveBps / 100}% into the close; ${r.slices.length} bounded liquidation slice(s)`,
          detail: { replay: PROVENANCE.gap.replay, openGapBps: r.openGapBps, closeMoveBps: r.closeMoveBps, slices: r.slices },
          chainTime: await t(),
        })
        return
      }
      case "synthetic-gap": {
        await this.fork.ledger.add({ kind: "scenario", summary: `scenario synthetic-gap started: ${syntheticGap.label}`, detail: { ...PROVENANCE.synthetic }, chainTime: await t() })
        await this.ensureScenarioBorrower()
        const r = await sc.syntheticGap(this.ctx, syntheticGap)
        await this.afterPriceScenario()
        const deficit = await this.fork.read<bigint>(this.opts.deployment.vault as Address, abi.vault, "totalDeficit")
        await this.fork.ledger.add({
          kind: "scenario",
          summary: `synthetic gap finished: ${syntheticGap.gapBps / 100}% drop, ${r.slices.length} liquidation slice(s), lender deficit ${Number(deficit) / 1e6} USDG`,
          detail: { replay: PROVENANCE.synthetic.replay, slices: r.slices, totalDeficit: deficit.toString() },
          chainTime: await t(),
        })
        return
      }
    }
  }

  private async scheduleAction() {
    const ratio = corporateActionData.scenario.splitRatio
    await this.fork.ledger.add({
      kind: "scenario",
      summary: `scenario corporate-action started: ${ratio}-for-1 split applied as a multiplier change (${corporateActionData.label})`,
      detail: { ...PROVENANCE.corporateAction },
      chainTime: await this.fork.chainTime(),
    })
    const r = await sc.corporateAction(this.ctx, BigInt(ratio))
    this.state.pendingAction = { activationAt: r.activationAt, ratio }
    await this.fork.ledger.add({
      kind: "scenario",
      summary: `corporate action pending: multiplier ${r.before} → ${r.after} activates at ${iso(r.activationAt)}; NVDAx borrowing and liquidation pause until the keeper resolves it`,
      detail: { activationAt: r.activationAt, before: r.before.toString(), after: r.after.toString() },
      chainTime: await this.fork.chainTime(),
    })
  }

  private async afterPriceScenario() {
    await this.postSpyx()
    this.state.keeperAt = this.now()
  }

  /** Gap scenarios need a borrower going into the weekend at the weekday (OPEN) limit. */
  private async ensureScenarioBorrower() {
    const nvda = this.opts.deployment.markets.find((m) => m.symbol === "NVDAx")!
    const [, debt] = await this.fork.read<[bigint, bigint]>(nvda.market as Address, abi.market, "positionOf", [SCENARIO_BORROWER])
    if (debt > 0n) {
      if (!this.state.watch.includes(SCENARIO_BORROWER)) this.state.watch.push(SCENARIO_BORROWER)
      return
    }
    // Warps to regular US hours if needed (the keeper posts OPEN), then borrows at the 50% weekday limit.
    await sc.openAtWeekdayLimit(this.ctx, SCENARIO_BORROWER, 20n * 10n ** 18n)
    await this.postSpyx()
  }

  /** Reverts to the snapshot taken right after start() and takes a fresh one (evm_revert consumes it). */
  async reset() {
    if (!this.state.snapshotId || !this.state.burnerAddress) throw new SandboxError(409, "not_started", "this session has no start snapshot to return to")
    const from = await this.fork.chainTime()
    const reverted = await this.fork.revert(this.state.snapshotId)
    if (!reverted) throw new SandboxError(409, "snapshot_missing", "the session's start snapshot is no longer available; start a new session")
    this.state.snapshotId = await this.fork.snapshot()
    this.state.watch.splice(0, this.state.watch.length, this.state.burnerAddress)
    this.state.pendingAction = undefined
    this.state.keeperAt = this.now()
    await this.fork.ledger.add({
      kind: "reset",
      summary: "session reset to its start: burner funded, keeper fresh; every later transaction, warp and scenario was discarded",
      detail: { fromChainTime: from },
      chainTime: await this.fork.chainTime(),
    })
  }

  async status(): Promise<ChainStatus> {
    const block = await this.fork.client.getBlock({ blockTag: "latest" })
    const index = await this.fork.read<number>(this.opts.deployment.sessionRisk as Address, abi.sessionRisk, "currentSession")
    return {
      chainTime: Number(block.timestamp),
      block: Number(block.number),
      forkBlock: this.opts.forkBlock,
      session: sessionFromIndex(Number(index)),
      burnerAddress: this.state.burnerAddress ?? null,
    }
  }
}
