"use client"

/**
 * Reads every Intatto event from the deployment block to the latest block, newest first, one eth_getLogs per
 * 100-block chunk for all contracts at once (decoded here), paced under the public RPC's rate limit with retry and
 * backoff. Rows appear as chunks land. On mainnet the cached /api/risk/logs route is the source, with direct reads as
 * the fallback; a sandbox reads its fork directly. New blocks are picked up by polling the head.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { parseEventLogs, type Address, type Hex, type PublicClient } from "viem"
import { useIntatto } from "@/lib/chain"
import { LOG_CHUNK, watchedAddresses, type RawLog } from "@/lib/risk-logs/addresses"
import { chunkRanges, RISK_EVENTS, type DecodedLog } from "./events"

const PERMISSIONLESS = new Set(["ActionResolved", "ActionCleared", "SliceWaiting"])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const hex = (n: bigint) => `0x${n.toString(16)}`

type Snapshot = {
  logs: DecodedLog[]
  times: Map<bigint, number>
  senders: Map<Hex, Address>
  head: bigint | null
  oldest: bigint | null
  scanned: bigint
  firstDone: boolean
  error: Error | null
  refreshing: boolean
}
const EMPTY: Snapshot = { logs: [], times: new Map(), senders: new Map(), head: null, oldest: null, scanned: 0n, firstDone: false, error: null, refreshing: false }

type Opts = { client: PublicClient; addresses: Address[]; floor: bigint; live: boolean; onChange: (s: Snapshot) => void }

class Scanner {
  private queue: { fromBlock: bigint; toBlock: bigint; backfill: boolean }[] = []
  private logs = new Map<string, DecodedLog>()
  private snap: Snapshot = EMPTY
  private stopped = false
  private slot: Promise<void> = Promise.resolve()
  private last = 0
  private routeFailures = 0
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private o: Opts) {}

  start() {
    void this.pollHead()
    this.timer = setInterval(() => void this.pollHead(), this.o.live ? 30_000 : 10_000)
    void this.loop()
  }

  stop() {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
  }

  async refresh() {
    this.emit({ refreshing: true })
    await this.pollHead()
    this.emit({ refreshing: false })
  }

  private emit(patch: Partial<Snapshot>) {
    if (this.stopped) return
    this.snap = { ...this.snap, ...patch }
    this.o.onChange(this.snap)
  }

  /** Serialises calls at ≤ ~3 requests/s on public X Layer; a local fork is not paced. */
  private pace(gapMs: number) {
    const next = this.slot.then(async () => {
      await sleep(Math.max(0, this.last + gapMs - Date.now()))
      this.last = Date.now()
    })
    this.slot = next
    return next
  }

  /** Retries with exponential backoff (1 s → 30 s) until it succeeds or the scanner stops. */
  private async call<T>(fn: () => Promise<T>, gapMs = this.o.live ? 350 : 0): Promise<T | null> {
    for (let attempt = 0; !this.stopped; attempt++) {
      await this.pace(gapMs)
      try {
        const v = await fn()
        if (this.snap.error) this.emit({ error: null })
        return v
      } catch (e) {
        if (attempt >= 1) this.emit({ error: e instanceof Error ? e : new Error(String(e)) })
        await sleep(Math.min(30_000, 1_000 * 2 ** attempt))
      }
    }
    return null
  }

  private async pollHead() {
    const latest = await this.call(() => this.o.client.getBlockNumber({ cacheTime: 0 }))
    if (latest === null || latest < this.o.floor) return
    const head = this.snap.head
    if (head === null) {
      this.queue.push(...chunkRanges(this.o.floor, latest, BigInt(LOG_CHUNK)).map((r) => ({ ...r, backfill: true })))
      this.emit({ head: latest })
    } else if (latest > head) {
      this.queue.unshift(...chunkRanges(head + 1n, latest, BigInt(LOG_CHUNK)).map((r) => ({ ...r, backfill: false })))
      this.emit({ head: latest })
    }
  }

  private async fetchChunk(fromBlock: bigint, toBlock: bigint): Promise<RawLog[]> {
    if (this.o.live && this.routeFailures < 3) {
      const res = await fetch(`/api/risk/logs?network=mainnet&from=${fromBlock}&to=${toBlock}`).catch(() => null)
      const body = res?.ok ? ((await res.json().catch(() => null)) as { logs?: RawLog[]; to?: string } | null) : null
      if (body?.logs && body.to === toBlock.toString()) {
        this.routeFailures = 0
        return body.logs
      }
      this.routeFailures++
    }
    await this.pace(this.o.live ? 350 : 0)
    return this.o.client.request({
      method: "eth_getLogs",
      params: [{ address: this.o.addresses, fromBlock: hex(fromBlock) as Hex, toBlock: hex(toBlock) as Hex }],
    } as never) as Promise<RawLog[]>
  }

  private async loop() {
    while (!this.stopped) {
      const chunk = this.queue.shift()
      if (!chunk) {
        await sleep(300)
        continue
      }
      const raw = await this.call(() => this.fetchChunk(chunk.fromBlock, chunk.toBlock), this.o.live ? 200 : 0)
      if (raw === null) return
      const decoded = parseEventLogs({
        abi: RISK_EVENTS,
        strict: true,
        logs: raw.map((l) => ({
          ...l,
          blockNumber: BigInt(l.blockNumber),
          logIndex: Number(l.logIndex),
          blockTimestamp: l.blockTimestamp ? BigInt(l.blockTimestamp) : undefined,
        })) as never,
      }) as unknown as DecodedLog[]
      const times = new Map(this.snap.times)
      const senders = new Map(this.snap.senders)
      for (const l of decoded) {
        this.logs.set(`${l.transactionHash}:${l.logIndex}`, l)
        if (l.blockNumber !== null && l.blockTimestamp !== undefined && l.blockTimestamp !== null) times.set(l.blockNumber, Number(l.blockTimestamp))
      }
      for (const b of new Set(decoded.map((l) => l.blockNumber).filter((b): b is bigint => b !== null && !times.has(b)))) {
        const block = await this.call(() => this.o.client.getBlock({ blockNumber: b }))
        if (block) times.set(b, Number(block.timestamp))
      }
      for (const l of decoded) {
        if (!l.eventName || !PERMISSIONLESS.has(l.eventName) || !l.transactionHash || senders.has(l.transactionHash)) continue
        const tx = await this.call(() => this.o.client.getTransaction({ hash: l.transactionHash! }))
        if (tx) senders.set(l.transactionHash, tx.from)
      }
      const oldest = chunk.backfill ? chunk.fromBlock : this.snap.oldest
      this.emit({
        logs: [...this.logs.values()],
        times,
        senders,
        oldest: oldest ?? chunk.fromBlock,
        scanned: this.snap.scanned + (chunk.toBlock - chunk.fromBlock + 1n),
        firstDone: true,
      })
    }
  }
}

export type RiskLogs = {
  status: "pending" | "error" | "success"
  error: Error | null
  logs: DecodedLog[]
  times: Map<bigint, number>
  senders: Map<Hex, Address>
  /** Oldest and newest block read so far (null until the first chunk lands). */
  range: { from: bigint; to: bigint } | null
  /** The deployment block: nothing older is read. */
  floor: bigint
  /** True while older chunks are still being read. */
  backfilling: boolean
  /** Share of the blocks since the deployment read so far (0–1). */
  progress: number
  refreshing: boolean
  refresh: () => void
}

export function useRiskLogs(): RiskLogs {
  const { deployment, publicClient, mode } = useIntatto()
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const scanner = useRef<Scanner | null>(null)
  const floor = BigInt(deployment?.block ?? 0)

  useEffect(() => {
    if (!deployment) return
    const s = new Scanner({ client: publicClient as PublicClient, addresses: watchedAddresses(deployment), floor: BigInt(deployment.block), live: mode === "live", onChange: setSnap })
    scanner.current = s
    s.start()
    return () => {
      s.stop()
      scanner.current = null
      setSnap(EMPTY)
    }
  }, [deployment, publicClient, mode])

  return useMemo<RiskLogs>(() => {
    const total = snap.head === null ? 0n : snap.head - floor + 1n
    return {
      status: snap.firstDone ? "success" : snap.error ? "error" : "pending",
      error: snap.error,
      logs: snap.logs,
      times: snap.times,
      senders: snap.senders,
      range: snap.firstDone && snap.head !== null ? { from: snap.oldest ?? snap.head, to: snap.head } : null,
      floor,
      backfilling: snap.head === null || (snap.oldest ?? snap.head) > floor,
      progress: total > 0n ? Math.min(1, Number((snap.scanned * 1000n) / total) / 1000) : 0,
      refreshing: snap.refreshing,
      refresh: () => void scanner.current?.refresh(),
    }
  }, [snap, floor])
}
