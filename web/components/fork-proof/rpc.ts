/**
 * Browser-side JSON-RPC access for the fork proof. Every read goes straight from this browser to the sandbox
 * RPC or to a public X Layer RPC; nothing passes through the Intatto server.
 */
import { createPublicClient, http, HttpRequestError, keccak256, TimeoutError, type Hex, type PublicClient } from "viem"
import { Cancelled, pacer, RETRYABLE, sleep, type Schedule } from "./pacer"

export type Side = "sandbox" | "reference"

export type ProofClient = {
  side: Side
  url: string
  client: PublicClient
  /** For reads tagged with a block number (historical state on a fork). */
  historical: Schedule
  /** For "latest" reads and untagged calls. */
  latest: Schedule
  /** False once a newer run has replaced the one this client belongs to. */
  alive: () => boolean
}

export const SIDE_NAME: Record<Side, string> = { sandbox: "sandbox RPC", reference: "X Layer RPC" }

/**
 * A read that got no value:
 * - "unreachable": no JSON-RPC answer at all (network failure, HTTP error, timeout);
 * - "refused": the RPC answered with a JSON-RPC error (e.g. -32602 for a block it cannot serve) that is not a revert.
 */
export class RpcFailure extends Error {
  constructor(
    readonly kind: "unreachable" | "refused",
    readonly side: Side,
    readonly url: string,
    message: string,
    readonly code: number | null = null,
    readonly method: string | null = null,
  ) {
    super(message)
  }
}

/** The JSON-RPC error code in viem's error chain, or null when the failure happened before any JSON-RPC answer. */
function rpcErrorCode(e: unknown): number | null {
  let cur: unknown = e
  for (let depth = 0; cur && typeof cur === "object" && depth < 8; depth++) {
    if (cur instanceof HttpRequestError || cur instanceof TimeoutError) return null
    const code = (cur as { code?: unknown }).code
    if (typeof code === "number") return code
    cur = (cur as { cause?: unknown }).cause
  }
  return null
}

function failure(c: ProofClient, e: unknown, method: string): RpcFailure {
  const code = rpcErrorCode(e)
  return new RpcFailure(code === null ? "unreachable" : "refused", c.side, c.url, shortError(e), code, method)
}

export function proofClient(side: Side, url: string, alive: () => boolean = () => true): ProofClient {
  const client = createPublicClient({ transport: http(url, { timeout: 25_000, retryCount: 0 }) }) as PublicClient
  if (side === "reference") {
    const shared = pacer(3, 2)
    return { side, url, client, historical: shared, latest: shared, alive }
  }
  return { side, url, client, historical: pacer(20, 1), latest: pacer(25, 4), alive }
}

function shortError(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { shortMessage?: string; details?: string; message?: string }
    const text = [o.shortMessage, o.details].filter(Boolean).join(": ") || o.message || String(e)
    return text.split("\n")[0]!.slice(0, 240)
  }
  return String(e).slice(0, 240)
}

export type BlockRef = bigint | "latest"
const tag = (b: BlockRef) => (b === "latest" ? "latest" : `0x${b.toString(16)}`)

async function send<T>(c: ProofClient, method: string, params: unknown[], block: BlockRef | null, tries = 5): Promise<T> {
  const schedule = block === null || block === "latest" ? c.latest : c.historical
  for (let i = 0; ; i++) {
    if (!c.alive()) throw new Cancelled()
    try {
      return await schedule(() => {
        if (!c.alive()) throw new Cancelled()
        return c.client.request({ method: method as never, params: params as never }) as Promise<T>
      })
    } catch (e) {
      if (e instanceof Cancelled || i >= tries - 1 || !RETRYABLE.test(shortError(e))) throw e
      await sleep(700 * 2 ** i)
    }
  }
}

async function raw<T>(c: ProofClient, method: string, params: unknown[], block: BlockRef | null): Promise<T> {
  try {
    return await send<T>(c, method, params, block)
  } catch (e) {
    if (e instanceof Cancelled) throw e
    throw failure(c, e, method)
  }
}

export const chainId = async (c: ProofClient) => Number(await raw<Hex>(c, "eth_chainId", [], null))

export type BlockInfo = { number: bigint; hash: Hex; parentHash: Hex; timestamp: bigint }

export async function getBlock(c: ProofClient, n: bigint): Promise<BlockInfo | null> {
  const b = await raw<{ number: Hex; hash: Hex; parentHash: Hex; timestamp: Hex } | null>(c, "eth_getBlockByNumber", [tag(n), false], n)
  if (!b) return null
  return { number: BigInt(b.number), hash: b.hash, parentHash: b.parentHash, timestamp: BigInt(b.timestamp) }
}

export type CodeInfo = { hash: Hex | null; size: number; code: Hex }

/** Runtime code at a block and its keccak256 (null hash when there is no code). */
export async function getCode(c: ProofClient, address: Hex, block: BlockRef): Promise<CodeInfo> {
  const code = await raw<Hex>(c, "eth_getCode", [address, tag(block)], block)
  const size = (code.length - 2) / 2
  return { code, size, hash: size > 0 ? keccak256(code) : null }
}

export async function getSlot(c: ProofClient, address: Hex, slot: Hex, block: BlockRef): Promise<Hex> {
  const v = await raw<Hex>(c, "eth_getStorageAt", [address, slot, tag(block)], block)
  // Some nodes return unpadded quantities; compare the canonical 32-byte word.
  return `0x${v.slice(2).padStart(64, "0")}` as Hex
}

export type CallResult = { ok: true; data: Hex } | { ok: false; reverted: string }

export async function call(c: ProofClient, to: Hex, data: Hex, block: BlockRef): Promise<CallResult> {
  try {
    return { ok: true, data: await send<Hex>(c, "eth_call", [{ to, data }, tag(block)], block) }
  } catch (e) {
    if (e instanceof Cancelled) throw e
    const msg = shortError(e)
    if (/revert/i.test(msg)) return { ok: false, reverted: msg }
    throw failure(c, e, "eth_call")
  }
}

/** The fork block the RPC itself reports (anvil_metadata); null when the RPC does not expose it. */
export async function reportedForkBlock(c: ProofClient): Promise<bigint | null> {
  try {
    const meta = await send<{ forkedNetwork?: { forkBlockNumber?: number | string } | null }>(c, "anvil_metadata", [], null, 1)
    const n = meta?.forkedNetwork?.forkBlockNumber
    return n === undefined || n === null ? null : BigInt(n)
  } catch {
    return null
  }
}

export type ReferencePick = {
  client: ProofClient | null
  tried: { url: string; ok: boolean; note: string }[]
}

/** Tries each public X Layer RPC in order and keeps the first that answers with chain id 196. */
export async function pickReference(urls: readonly string[], expectedChainId: number, alive: () => boolean): Promise<ReferencePick> {
  const tried: ReferencePick["tried"] = []
  for (const url of urls) {
    const c = proofClient("reference", url, alive)
    try {
      const id = await Promise.race([
        send<Hex>(c, "eth_chainId", [], null, 2).then(Number),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no answer in 10 s")), 10_000)),
      ])
      if (id === expectedChainId) {
        tried.push({ url, ok: true, note: `answered chain id ${id}` })
        return { client: c, tried }
      }
      tried.push({ url, ok: false, note: `answered chain id ${id}, expected ${expectedChainId}` })
    } catch (e) {
      if (e instanceof Cancelled) throw e
      tried.push({ url, ok: false, note: e instanceof Error ? e.message.split("\n")[0]!.slice(0, 160) : String(e) })
    }
  }
  return { client: null, tried }
}
