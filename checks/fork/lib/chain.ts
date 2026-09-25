/**
 * Portable fork control (viem only, no Node APIs): used by the local harness, the checks and the hosted
 * sandbox's Durable Object. Every mutating call goes through here so it can be written to the ledger.
 */
import {
  createPublicClient,
  encodeFunctionData,
  http,
  type Abi,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
} from "viem"
import { xLayer } from "viem/chains"

export type LedgerEntry = {
  kind: "fund" | "warp" | "keeper" | "actor" | "scenario" | "reset" | "deploy" | "note"
  summary: string
  detail?: Record<string, unknown>
  txHash?: Hex
  chainTime: number
  at: string
}

export class Ledger {
  entries: LedgerEntry[] = []
  constructor(private sink?: (e: LedgerEntry) => void | Promise<void>) {}
  async add(e: Omit<LedgerEntry, "at">) {
    const entry = { ...e, at: new Date().toISOString() }
    this.entries.push(entry)
    await this.sink?.(entry)
    return entry
  }
}

export class ForkChain {
  readonly client: PublicClient
  constructor(
    readonly rpcUrl: string,
    readonly chainId: number,
    readonly ledger: Ledger = new Ledger(),
  ) {
    const chain = { ...xLayer, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } } as Chain
    this.client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 120_000 }) }) as PublicClient
  }

  request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    return this.client.request({ method: method as never, params: params as never }) as Promise<T>
  }

  async chainTime(): Promise<number> {
    const block = await this.client.getBlock({ blockTag: "latest" })
    return Number(block.timestamp)
  }

  /** Sends from an impersonated (or unlocked) account and waits for the receipt; reverts throw. */
  async send(from: Address, to: Address, data: Hex, value = 0n, gas?: bigint): Promise<Hex> {
    await this.request("anvil_impersonateAccount", [from])
    // Simulate first: anvil turns a reverting estimate into a misleading "insufficient funds" error.
    const tx = { from, to, data, value: `0x${value.toString(16)}` }
    await this.request("eth_call", [tx, "latest"]).catch((e: unknown) => {
      const err = e as { details?: string; data?: unknown; cause?: { data?: unknown } }
      const revertData = err.data ?? err.cause?.data
      throw new Error(`would revert: ${err.details ?? (e instanceof Error ? e.message.split("\n")[0] : String(e))}${revertData ? ` data=${JSON.stringify(revertData)}` : ""}`)
    })
    // Forked state loads lazily, so anvil's estimate can come in low: send with 50% headroom.
    const limit = gas ?? ((BigInt(await this.request<Hex>("eth_estimateGas", [tx])) * 3n) / 2n + 50_000n)
    const hash = await this.request<Hex>("eth_sendTransaction", [{ ...tx, gas: `0x${limit.toString(16)}` }])
    // eth_sendTransaction can return before the receipt exists, even with auto-mining: poll.
    const receipt = await this.client.waitForTransactionReceipt({ hash, pollingInterval: 250, timeout: 120_000 })
    if (receipt.status !== "success") {
      // Replay as a call at the parent block to surface the revert data.
      const reason = await this.request("eth_call", [{ from, to, data, value: `0x${value.toString(16)}` }, `0x${(receipt.blockNumber - 1n).toString(16)}`]).then(
        () => "no revert data",
        (e: unknown) => (e instanceof Error ? e.message.split("\n").slice(0, 3).join(" ") : String(e)),
      )
      throw new Error(`transaction ${hash} to ${to} reverted: ${reason}`)
    }
    return hash
  }

  async write(from: Address, to: Address, abi: Abi, functionName: string, args: readonly unknown[] = [], gas?: bigint) {
    try {
      return await this.send(from, to, encodeFunctionData({ abi, functionName, args } as never), 0n, gas)
    } catch (e) {
      throw new Error(`${functionName} failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  read<T>(to: Address, abi: Abi, functionName: string, args: readonly unknown[] = []): Promise<T> {
    return this.client.readContract({ address: to, abi, functionName, args } as never) as Promise<T>
  }

  /** Moves chain time to exactly `timestamp` and mines a block there. */
  async warpTo(timestamp: number, why: string) {
    const from = await this.chainTime()
    if (timestamp <= from) throw new Error(`cannot warp backwards (${timestamp} <= ${from})`)
    await this.request("evm_setNextBlockTimestamp", [timestamp])
    await this.request("evm_mine", [])
    await this.ledger.add({ kind: "warp", summary: why, detail: { from, to: timestamp }, chainTime: timestamp })
  }

  async warpBy(seconds: number, why: string) {
    return this.warpTo((await this.chainTime()) + seconds, why)
  }

  async snapshot(): Promise<Hex> {
    return this.request<Hex>("evm_snapshot", [])
  }

  async revert(id: Hex): Promise<boolean> {
    return this.request<boolean>("evm_revert", [id])
  }
}
