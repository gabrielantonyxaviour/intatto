"use client"

/**
 * Sandbox screen data: which API base the page talks to, the API's health, the stored session's status and
 * ledger, the fork's clock and chain id, the burner's balances, and the admin actions (each refreshes every read).
 */
import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { erc20Abi, type Address } from "viem"
import { TICKERS } from "@intatto/config/xlayer"
import { useIntatto } from "@/lib/chain"
import { formatUtc } from "@/components/ui/web3/format"
import { DEFAULT_SANDBOX_API_URL, normalizeApiUrl, sandboxApi, type ActionResult, type AdminRequest } from "./api"
import { requestLabel } from "./copy"

export type ApiBase = {
  /** The base URL the page calls, or null when the active session has no API (a bare local fork). */
  base: string | null
  /** `?api=` as given, when present. */
  override: string | null
  overrideInvalid: boolean
}

function readOverride(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("api")
  } catch {
    return null
  }
}

/** The active session's API; otherwise `?api=<url>` (checks, self-hosters); otherwise the hosted sandbox. */
export function useApiBase(): ApiBase {
  const { sandbox } = useIntatto()
  // Rendered only after hydration (inside <ChainReady>), so window is available here.
  const override = useMemo(() => (typeof window === "undefined" ? null : readOverride()), [])
  const normalized = normalizeApiUrl(override)
  if (sandbox) return { base: normalizeApiUrl(sandbox.apiUrl), override, overrideInvalid: false }
  return { base: normalized ?? DEFAULT_SANDBOX_API_URL, override, overrideInvalid: Boolean(override) && !normalized }
}

export function useHealth(base: string | null) {
  return useQuery({
    queryKey: ["sandbox-api", base, "health"],
    enabled: Boolean(base),
    queryFn: () => sandboxApi.health(base!),
    retry: 1,
  })
}

export function useSessionInfo(base: string | null, sessionId: string | undefined) {
  return useQuery({
    queryKey: ["sandbox-api", base, "session", sessionId],
    enabled: Boolean(base && sessionId),
    queryFn: () => sandboxApi.info(base!, sessionId!),
    refetchInterval: 30_000,
    retry: 1,
  })
}

export function useLedger(base: string | null, sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["sandbox-api", base, "ledger", sessionId],
    enabled: Boolean(base && sessionId && enabled),
    queryFn: () => sandboxApi.ledger(base!, sessionId!),
    refetchInterval: 15_000,
    retry: 1,
  })
}

/** The fork's latest block; shares its cache entry with the sandbox banner, so both show the same chain time. */
export function useLatestBlock() {
  const { publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["intatto:latest-block", chainId],
    queryFn: () => publicClient.getBlock({ blockTag: "latest" }),
    refetchInterval: 5_000,
    retry: 1,
  })
}

/** The chain id the RPC answers with (the wrong-network check). */
export function useRpcChainId() {
  const { publicClient, rpcUrl } = useIntatto()
  return useQuery({
    queryKey: ["sandbox:rpc-chain-id", rpcUrl],
    queryFn: () => publicClient.getChainId(),
    staleTime: 60_000,
    retry: 1,
  })
}

export type BurnerBalances = { NVDAx: bigint; SPYx: bigint; USDG: bigint; OKB: bigint }

export function useBurnerBalances(address: Address | undefined) {
  const { publicClient, chainId, deployment } = useIntatto()
  return useQuery({
    queryKey: ["sandbox:balances", chainId, address],
    enabled: Boolean(address && deployment),
    refetchInterval: 15_000,
    retry: 1,
    queryFn: async (): Promise<BurnerBalances> => {
      const token = (symbol: "NVDAx" | "SPYx") =>
        (deployment!.markets.find((m) => m.symbol === symbol)?.token ?? TICKERS[symbol].token) as Address
      const balanceOf = (t: Address) => publicClient.readContract({ address: t, abi: erc20Abi, functionName: "balanceOf", args: [address!] })
      const [NVDAx, SPYx, USDG, OKB] = await Promise.all([
        balanceOf(token("NVDAx")),
        balanceOf(token("SPYx")),
        balanceOf(deployment!.usdg as Address),
        publicClient.getBalance({ address: address! }),
      ])
      return { NVDAx, SPYx, USDG, OKB }
    },
  })
}

/** Runs one admin action on the session's fork; afterwards every read on every screen is refreshed. */
export function useAdminAction(base: string | null, sessionId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation<ActionResult, Error, AdminRequest>({
    mutationKey: ["sandbox-admin", base, sessionId],
    mutationFn: (r) => {
      if (!base || !sessionId) throw new Error("This session has no sandbox API to run admin actions through.")
      if (r.kind === "warp") return sandboxApi.warp(base, sessionId, r.target)
      if (r.kind === "scenario") return sandboxApi.scenario(base, sessionId, r.name)
      return sandboxApi.reset(base, sessionId)
    },
    onSuccess: (result, r) =>
      toast.success(`${requestLabel(r)}: done`, {
        description: `${result.entries.length} admin calls in the ledger${result.chain ? ` · chain time ${formatUtc(result.chain.chainTime)} · ${result.chain.session}` : ""}`,
      }),
    onError: (e, r) => toast.error(`${requestLabel(r)} did not complete`, { description: e.message }),
    onSettled: () => queryClient.invalidateQueries(),
  })
}
