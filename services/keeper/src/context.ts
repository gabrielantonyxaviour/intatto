/** What runCycle takes, its tunables, and the context every step receives. */
import { parseUnits, type PublicClient, type WalletClient } from "viem"
import type { Deployment } from "@intatto/config/deployments"
import type { IssuerAdapter } from "./issuer.ts"
import type { ActionLog, KeeperAction, KeeperState } from "./types.ts"
import type { Clients } from "./chain.ts"

export type CycleDeps = {
  publicClient: PublicClient
  /** Carries the operator account (the deployment's keeper). */
  walletClient: WalletClient
  deployment: Deployment
  issuer: IssuerAdapter
  /** Appends one action to the durable log. */
  log: ActionLog
  /** Keeper clock, unix seconds. */
  now: () => number
  /** Cursors and last-post memory; in-memory when omitted. */
  state?: KeeperState
  options?: Partial<CycleOptions>
}

export type CycleOptions = {
  /** Send a price the relay would reject (it records the rejection onchain). Default false. */
  sendRejected: boolean
  sessionMaxAgeSec: number
  priceMaxAgeSec: number
  /** Re-post the price when it moved more than this (10 = 0.1%). */
  priceMoveBps: number
  capMaxAgeSec: number
  capChangeBps: number
  /** QuoterV2 sell sizes in wrapper shares (18 dec), smallest first. */
  depthSizes: bigint[]
  depthSlippageBps: number
  capHaircutBps: number
  sliceBps: number
  logChunkBlocks: bigint
  maxLogChunksPerCycle: number
  maxBorrowersPerCycle: number
  maxLiquidationsPerCycle: number
}

export const DEFAULT_OPTIONS: CycleOptions = {
  sendRejected: false,
  sessionMaxAgeSec: 10 * 60,
  priceMaxAgeSec: 5 * 60,
  priceMoveBps: 10,
  capMaxAgeSec: 60 * 60,
  capChangeBps: 500,
  depthSizes: ["0.5", "2", "10", "50", "200"].map((s) => parseUnits(s, 18)),
  depthSlippageBps: 200,
  capHaircutBps: 5_000,
  sliceBps: 2_500,
  logChunkBlocks: 100n,
  maxLogChunksPerCycle: 30,
  maxBorrowersPerCycle: 500,
  maxLiquidationsPerCycle: 5,
}

export type StepContext = Clients & {
  deployment: Deployment
  state: KeeperState
  o: CycleOptions
  /** Keeper clock at cycle start (unix seconds). */
  t: number
  /** Timestamp of the latest block at cycle start. */
  chainTime: number
  log: (action: Omit<KeeperAction, "at">) => Promise<void>
}
