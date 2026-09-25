"use client"

import { useQuery } from "@tanstack/react-query"
import { getAddress, isAddress, type Address } from "viem"
import { priceRelayAdapterAbi } from "@intatto/config/abi"
import { useIntatto } from "@/lib/chain"
import { AddressDisplay } from "@/components/ui/web3"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/** Onchain keeper() of the first market's PriceRelayAdapter. Never the deployment file's keeper field. */
function useRelayKeeper() {
  const { deployment, publicClient, chainId, mode, rpcUrl, sandbox, hydrated } = useIntatto()
  const relay = deployment?.markets[0]?.priceRelay
  const query = useQuery({
    queryKey: ["agents:relay-keeper", mode, chainId, rpcUrl, sandbox?.sessionId, relay],
    enabled: hydrated && Boolean(relay),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const keeper = await publicClient.readContract({
        address: relay as Address,
        abi: priceRelayAdapterAbi,
        functionName: "keeper",
      })
      if (typeof keeper !== "string" || !isAddress(keeper)) throw new Error("keeper() did not return an address")
      return getAddress(keeper)
    },
  })
  return { relay, hydrated, ...query }
}

export function KeeperAddress() {
  const keeper = useRelayKeeper()
  const loading = !keeper.hydrated || Boolean(keeper.relay && (keeper.isPending || keeper.isFetching))
  if (loading) return <Skeleton className="h-5 w-44" aria-hidden />
  if (!keeper.relay) {
    return <p className="text-sm text-muted-foreground">The keeper address appears once Intatto is deployed.</p>
  }
  if (keeper.isError || !keeper.data) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">The keeper read failed.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void keeper.refetch()}>
          Retry
        </Button>
      </div>
    )
  }
  return <AddressDisplay address={keeper.data} chars={6} />
}
