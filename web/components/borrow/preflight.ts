"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { REFUSALS } from "@intatto/config/session"
import { useIntatto } from "@/lib/chain"
import { decodeTxError, type ContractRequest, type DecodedTxError } from "@/components/ui/web3"

export type Preflight =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "refused"; error: DecodedTxError }
  | { status: "failed"; error: DecodedTxError; retry: () => void }

/** Same key TxButton uses, so the review's button reuses this result instead of re-checking from scratch. */
const keyOf = (req: ContractRequest) =>
  JSON.stringify([req.address, req.functionName, req.args ?? [], req.value ?? null], (_, v) =>
    typeof v === "bigint" ? `${v}n` : v,
  )

/**
 * Asks the contract itself, before any signature: simulates `request` from the connected account on the active
 * chain (eth_call against the latest block) and decodes a revert into its custom error and human reason.
 */
export function usePreflight(request: ContractRequest | null): Preflight {
  const { chain, publicClient } = useIntatto()
  const { address, chainId, isConnected } = useAccount()
  const onChain = isConnected && chainId === chain.id
  const q = useQuery({
    queryKey: ["intatto:simulate", chain.id, address ?? null, request ? keyOf(request) : null],
    queryFn: async () => {
      await publicClient.simulateContract({ ...request!, account: address! } as Parameters<
        typeof publicClient.simulateContract
      >[0])
      return true
    },
    enabled: onChain && !!request && !!address,
    retry: false,
    staleTime: 5_000,
    refetchInterval: 15_000,
  })
  if (!request || !onChain) return { status: "idle" }
  if (q.error) {
    const error = decodeTxError(q.error, REFUSALS)
    return error.kind === "refused" ? { status: "refused", error } : { status: "failed", error, retry: () => void q.refetch() }
  }
  if (q.data) return { status: "ok" }
  return { status: "checking" }
}
