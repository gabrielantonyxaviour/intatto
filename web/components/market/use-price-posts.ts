"use client"

/** The relay's most recent accepted keeper posts (PricePosted events), newest first. */
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { priceRelayAdapterAbi } from "@intatto/config/abi"
import { XLAYER_LOGS_BLOCK_SPAN } from "@intatto/config/xlayer"
import { useIntatto, useMarketDeployment, type MarketSymbol } from "@/lib/chain"

export type PricePost = {
  quoteE18: bigint
  twapE18: bigint
  deviationBps: bigint
  moveBps: bigint
  fetchedAt: number
  blockNumber: bigint
  txHash: `0x${string}`
}

const WANT = 8
/** X Layer caps eth_getLogs at ~100 blocks per call, so only the recent past before a fork (or on mainnet) is scanned. */
const UPSTREAM_WINDOWS = 10

/** `latestFetchedAt` (the market's current fetch time) is in the key, so a new keeper post refreshes the list at once. */
export function usePricePosts(symbol: MarketSymbol, latestFetchedAt: number) {
  const m = useMarketDeployment(symbol)
  const { publicClient, chainId, deployment, sandbox } = useIntatto()
  return useQuery({
    queryKey: ["market-screen", "price-posts", chainId, m?.priceRelay, latestFetchedAt],
    placeholderData: (previous) => previous,
    enabled: Boolean(m && deployment),
    refetchInterval: 30_000,
    queryFn: async (): Promise<{ posts: PricePost[]; scannedFrom: bigint }> => {
      const address = m!.priceRelay as Address
      const latest = await publicClient.getBlockNumber()
      const fetch = (fromBlock: bigint, toBlock: bigint) =>
        publicClient.getContractEvents({ address, abi: priceRelayAdapterAbi, eventName: "PricePosted", fromBlock, toBlock })

      const deployedAt = BigInt(deployment!.block)
      let logs: Awaited<ReturnType<typeof fetch>> = []
      let to = latest
      if (sandbox) {
        // Blocks mined on the fork are local, so one call covers them. A fork of a live deployment also has
        // posts from before the fork, which the fork fetches upstream: those go through the windows below.
        const localFrom = BigInt(sandbox.forkBlock) + 1n > deployedAt ? BigInt(sandbox.forkBlock) + 1n : deployedAt
        if (localFrom <= latest) logs = await fetch(localFrom, latest)
        to = localFrom - 1n
      }
      let scannedFrom = to + 1n
      for (let i = 0; i < UPSTREAM_WINDOWS && logs.length < WANT && to >= deployedAt && to > 0n; i++) {
        const from = to - XLAYER_LOGS_BLOCK_SPAN + 1n > deployedAt ? to - XLAYER_LOGS_BLOCK_SPAN + 1n : deployedAt
        logs = [...(await fetch(from, to)), ...logs]
        scannedFrom = from
        to = from - 1n
      }
      const posts = logs
        .map((l) => ({
          quoteE18: l.args.quoteE18 ?? 0n,
          twapE18: l.args.twapWrapperPriceE18 ?? 0n,
          deviationBps: l.args.deviationBps ?? 0n,
          moveBps: l.args.moveBps ?? 0n,
          fetchedAt: Number(l.args.fetchedAt ?? 0n),
          blockNumber: l.blockNumber ?? 0n,
          txHash: (l.transactionHash ?? "0x") as `0x${string}`,
        }))
        .reverse()
        .slice(0, WANT)
      return { posts, scannedFrom }
    },
  })
}
