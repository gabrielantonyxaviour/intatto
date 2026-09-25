/**
 * Every address that has borrowed on a sandbox market, from CollateralMarket Borrowed logs.
 * The scan starts at deployment.block and then only reads new blocks. Public eth_getLogs is capped
 * at 100 blocks, and anvil serves the pre-fork part of that range from upstream.
 */
import { getAddress, parseAbiItem, type Address } from "viem"
import type { Deployment } from "@intatto/config/deployments"
import { XLAYER_LOGS_BLOCK_SPAN } from "@intatto/config/xlayer"
import type { ForkChain } from "../../../checks/fork/lib/chain.ts"
import * as abi from "../../../checks/fork/lib/abis.ts"
import type { BorrowerScan } from "./types.ts"

const BORROWED = parseAbiItem("event Borrowed(address indexed user, uint256 amount, uint256 ltvAfterBps, uint256 maxLtvBps)")
const SLICE = parseAbiItem(
  "event SliceExecuted(address indexed market, address indexed borrower, uint8 session, uint256 sharesSold, uint256 proceeds, uint256 oraclePrice, uint256 floorPrice)",
)
/** Never ask upstream for more than its log cap. */
const CHUNK = XLAYER_LOGS_BLOCK_SPAN > 100n ? 100n : XLAYER_LOGS_BLOCK_SPAN

async function withRetry<T>(read: () => Promise<T>): Promise<T> {
  let wait = 500
  for (let attempt = 0; ; attempt++) {
    try {
      return await read()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (attempt >= 5 || !/rate limit|timeout|429|32005|32016|header not found/i.test(message)) throw e
      await new Promise((resolve) => setTimeout(resolve, wait))
      wait *= 2
    }
  }
}

async function usersInRange(fork: ForkChain, market: Address, from: bigint, to: bigint): Promise<Address[]> {
  const out: Address[] = []
  for (let start = from; start <= to; start += CHUNK) {
    const end = start + CHUNK - 1n <= to ? start + CHUNK - 1n : to
    const logs = await withRetry(() => fork.client.getLogs({ address: market, event: BORROWED, fromBlock: start, toBlock: end }))
    for (const log of logs) if (log.args.user) out.push(getAddress(log.args.user))
  }
  return out
}

/** Extends `index` with Borrowed users from the first unscanned block through the current head. */
export async function syncBorrowers(fork: ForkChain, deployment: Deployment, index: BorrowerScan): Promise<void> {
  const latest = await fork.client.getBlockNumber()
  const origin = BigInt(deployment.block)
  if (index.scannedTo < Number(origin) - 1 || BigInt(index.scannedTo) > latest) {
    index.scannedTo = Number(origin) - 1
    index.addresses = []
  }
  let from = BigInt(index.scannedTo) + 1n
  if (from < origin) from = origin
  if (from > latest) return
  const seen = new Set(index.addresses.map((a) => a.toLowerCase()))
  for (const market of deployment.markets) {
    for (const user of await usersInRange(fork, market.market as Address, from, latest)) {
      const key = user.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      index.addresses.push(user)
    }
  }
  index.scannedTo = Number(latest)
}

/** Drops addresses that currently owe nothing on any market. */
export async function withDebt(fork: ForkChain, deployment: Deployment, addresses: readonly Address[]): Promise<Address[]> {
  const owing: Address[] = []
  for (const who of addresses) {
    let debt = 0n
    for (const market of deployment.markets) debt += await fork.read<bigint>(market.market as Address, abi.market, "debtOf", [who])
    if (debt > 0n) owing.push(who)
  }
  return owing
}

/** Adds `extra` to `watch` without duplicating an address that is already there. */
export function unionWatch(watch: Address[], extra: readonly Address[]) {
  const seen = new Set(watch.map((a) => a.toLowerCase()))
  for (const who of extra) {
    if (seen.has(who.toLowerCase())) continue
    seen.add(who.toLowerCase())
    watch.push(who)
  }
}

/** Borrowers a SliceExecuted event named in `[from, head]`. */
export async function liquidatedSince(fork: ForkChain, liquidator: Address, from: bigint): Promise<Address[]> {
  const latest = await fork.client.getBlockNumber()
  if (from > latest) return []
  const seen = new Set<string>()
  const out: Address[] = []
  for (let start = from; start <= latest; start += CHUNK) {
    const end = start + CHUNK - 1n <= latest ? start + CHUNK - 1n : latest
    const logs = await withRetry(() => fork.client.getLogs({ address: liquidator, event: SLICE, fromBlock: start, toBlock: end }))
    for (const log of logs) {
      const who = log.args.borrower ? getAddress(log.args.borrower) : undefined
      if (!who || seen.has(who.toLowerCase())) continue
      seen.add(who.toLowerCase())
      out.push(who)
    }
  }
  return out
}
