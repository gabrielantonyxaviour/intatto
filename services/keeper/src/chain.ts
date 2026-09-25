/**
 * RPC helpers for the keeper: retried reads and simulations, and sends that sign once and rebroadcast the same
 * raw transaction on transport errors, so a retry can never produce a second transaction.
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeFunctionData,
  keccak256,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem"

export type Clients = { publicClient: PublicClient; walletClient: WalletClient }

export type Call = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The custom error (or reason) a call reverted with, or null when the failure was not a revert. */
export function revertName(e: unknown): string | null {
  if (!(e instanceof BaseError)) return null
  const r = e.walk((x) => x instanceof ContractFunctionRevertedError)
  if (r instanceof ContractFunctionRevertedError) return r.data?.errorName ?? r.reason ?? "reverted"
  return null
}

/** One readable line for the action log: never a stack trace, raw RPC payload or key material. */
export function shortError(e: unknown): string {
  const name = revertName(e)
  if (name) return `reverted with ${name}`
  const msg = e instanceof BaseError ? e.shortMessage : e instanceof Error ? e.message : "unknown error"
  return msg.split("\n")[0].replace(/0x[0-9a-fA-F]{64,}/g, "0x…").slice(0, 200)
}

const TRANSIENT = /timeout|timed out|took too long|rate limit|too many requests|429|502|503|504|ECONNRESET|ECONNREFUSED|fetch failed|socket|network|header not found|internal error/i

export function isTransient(e: unknown): boolean {
  if (revertName(e) !== null) return false
  const text = e instanceof BaseError ? `${e.shortMessage} ${e.details ?? ""}` : e instanceof Error ? e.message : String(e)
  return TRANSIENT.test(text)
}

/** Retries transient RPC failures with exponential backoff (400 ms, 800 ms, …); reverts fail at once. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 400): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (!isTransient(e) || i === attempts - 1) throw e
      await sleep(baseMs * 2 ** i)
    }
  }
  throw last
}

export function read<T>(c: Clients, call: Call): Promise<T> {
  return withRetry(() => c.publicClient.readContract({ ...call, args: call.args ?? [] } as never) as Promise<T>)
}

/** eth_call as the operator; returns the decoded result. Reverts throw (see revertName). */
export async function simulate<T>(c: Clients, call: Call): Promise<T> {
  const account = c.walletClient.account
  if (!account) throw new Error("the wallet client has no operator account")
  const { result } = await withRetry(() => c.publicClient.simulateContract({ ...call, args: call.args ?? [], account } as never))
  return result as T
}

/**
 * Signs the call once and broadcasts it (rebroadcasting the same bytes on transport errors), then waits for the
 * receipt. Throws when the transaction reverts onchain.
 */
export async function sendCall(c: Clients, call: Call): Promise<{ hash: Hex; receipt: TransactionReceipt }> {
  const account = c.walletClient.account
  if (!account) throw new Error("the wallet client has no operator account")
  const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args ?? [] } as never)
  const prepared = await withRetry(() =>
    c.walletClient.prepareTransactionRequest({ account, chain: c.walletClient.chain, to: call.address, data } as never),
  )
  const serializedTransaction = await c.walletClient.signTransaction(prepared as never)
  const hash = keccak256(serializedTransaction)
  await withRetry(async () => {
    try {
      await c.walletClient.sendRawTransaction({ serializedTransaction })
    } catch (e) {
      // A rebroadcast of bytes the node already has is a success.
      if (/already known|known transaction|already imported/i.test(e instanceof Error ? e.message : String(e))) return
      throw e
    }
  })
  const receipt = await c.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 1_000 })
  if (receipt.status !== "success") throw new Error(`transaction ${hash} reverted onchain`)
  return { hash, receipt }
}

/** |a - ref| * 10_000 / ref rounded up (the relay's deviation formula); ref must be > 0. */
export function diffBpsCeil(a: bigint, ref: bigint): bigint {
  const diff = a > ref ? a - ref : ref - a
  return (diff * 10_000n + ref - 1n) / ref
}

/** Runs `fn` over `items` `size` at a time. */
export async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return out
}
