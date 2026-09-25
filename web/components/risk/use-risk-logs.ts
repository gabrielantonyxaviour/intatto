"use client"

/**
 * Scans the console's events backwards in ~100-block chunks (X Layer caps eth_getLogs at about 100 blocks),
 * one bounded window at a time, never before the deployment block. "Load older" adds the next window.
 */
import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import type { Address, Hex } from "viem"
import { XLAYER_LOGS_BLOCK_SPAN } from "@intatto/config/xlayer"
import { useIntatto } from "@/lib/chain"
import { chunkRanges, RISK_EVENTS, watchedAddresses, type DecodedLog } from "./events"

function configuredWindow(): bigint {
  // Must stay a literal `process.env.NEXT_PUBLIC_…` read so Next inlines it at build time.
  const raw = process.env.NEXT_PUBLIC_RISK_SCAN_BLOCKS
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(n) && n >= 100 && n <= 1_000_000 ? BigInt(n) : 3_000n
}

/** Blocks scanned per window (default 3,000; NEXT_PUBLIC_RISK_SCAN_BLOCKS overrides). */
export const SCAN_WINDOW = configuredWindow()
const CONCURRENCY = 4
/** Events whose transaction anyone may send: the console looks up who sent them. */
const PERMISSIONLESS = new Set(["ActionResolved", "ActionCleared", "SliceWaiting"])

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export type ScanPage = {
  from: bigint
  to: bigint
  logs: DecodedLog[]
  times: [bigint, number][]
  senders: [Hex, Address][]
}

export type RiskLogs = {
  status: "pending" | "error" | "success"
  error: Error | null
  logs: DecodedLog[]
  times: Map<bigint, number>
  senders: Map<Hex, Address>
  /** Oldest and newest block scanned so far (null until the first window lands). */
  range: { from: bigint; to: bigint } | null
  /** First block the console will ever scan: the deployment block. */
  floor: bigint
  canLoadOlder: boolean
  loadingOlder: boolean
  refreshing: boolean
  loadOlder: () => void
  refresh: () => void
}

export function useRiskLogs(): RiskLogs {
  const { deployment, publicClient, chainId } = useIntatto()
  const floor = BigInt(deployment?.block ?? 0)
  const addresses = useMemo(() => (deployment ? watchedAddresses(deployment) : []), [deployment])

  const query = useInfiniteQuery({
    queryKey: ["risk-logs", chainId, deployment?.lens ?? null, String(SCAN_WINDOW)],
    enabled: Boolean(deployment),
    initialPageParam: null as bigint | null,
    queryFn: async ({ pageParam }): Promise<ScanPage> => {
      const to = pageParam ?? (await publicClient.getBlockNumber({ cacheTime: 0 }))
      const from = to - SCAN_WINDOW + 1n > floor ? to - SCAN_WINDOW + 1n : floor
      if (to < from) return { from, to, logs: [], times: [], senders: [] }
      const chunks = await mapLimit(chunkRanges(from, to, XLAYER_LOGS_BLOCK_SPAN), CONCURRENCY, (r) =>
        publicClient.getLogs({ address: addresses, events: RISK_EVENTS, fromBlock: r.fromBlock, toBlock: r.toBlock }),
      )
      const logs = chunks.flat() as unknown as DecodedLog[]

      const times = new Map<bigint, number>()
      const missing = new Set<bigint>()
      for (const l of logs) {
        if (l.blockNumber === null) continue
        if (l.blockTimestamp !== undefined && l.blockTimestamp !== null) times.set(l.blockNumber, Number(l.blockTimestamp))
        else missing.add(l.blockNumber)
      }
      const blocks = await mapLimit([...missing].filter((b) => !times.has(b)), CONCURRENCY, (blockNumber) =>
        publicClient.getBlock({ blockNumber }),
      )
      for (const b of blocks) if (b.number !== null) times.set(b.number, Number(b.timestamp))

      const txs = [...new Set(logs.filter((l) => l.eventName && PERMISSIONLESS.has(l.eventName) && l.transactionHash).map((l) => l.transactionHash!))]
      const sent = await mapLimit(txs, CONCURRENCY, async (hash) => [hash, (await publicClient.getTransaction({ hash })).from] as [Hex, Address])
      return { from, to, logs, times: [...times], senders: sent }
    },
    getNextPageParam: (last) => (last.from > floor ? last.from - 1n : undefined),
    // Only the newest window refreshes on its own; older windows refresh with the Refresh button.
    refetchInterval: (q) => ((q.state.data?.pages.length ?? 0) <= 1 ? 60_000 : false),
    staleTime: 15_000,
  })

  return useMemo<RiskLogs>(() => {
    const pages = query.data?.pages ?? []
    const times = new Map<bigint, number>()
    const senders = new Map<Hex, Address>()
    for (const p of pages) {
      for (const [b, t] of p.times) times.set(b, t)
      for (const [h, a] of p.senders) senders.set(h, a)
    }
    return {
      status: query.status,
      error: (query.error as Error | null) ?? null,
      logs: pages.flatMap((p) => p.logs),
      times,
      senders,
      range: pages.length ? { from: pages[pages.length - 1]!.from, to: pages[0]!.to } : null,
      floor,
      canLoadOlder: Boolean(query.hasNextPage),
      loadingOlder: query.isFetchingNextPage,
      refreshing: query.isRefetching,
      loadOlder: () => void query.fetchNextPage(),
      refresh: () => void query.refetch(),
    }
  }, [query, floor])
}
