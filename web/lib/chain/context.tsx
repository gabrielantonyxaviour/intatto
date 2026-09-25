"use client"

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Chain, PublicClient, Transport } from "viem"
import { explorerAddress, explorerTx } from "@intatto/config/xlayer"
import type { Deployment } from "@intatto/config/deployments"
import { buildRuntime, type ChainMode } from "./runtime"
import { BurnerAutoConnect } from "./burner-auto-connect"
import {
  SANDBOX_CHANGE_EVENT,
  SANDBOX_STORAGE_KEY,
  clearSandboxSession,
  sandboxSessionSchema,
  writeSandboxSession,
  type SandboxSession,
} from "./sandbox-session"

export type IntattoChain = {
  /** False on the server and during the first client render; localStorage has not been read yet. */
  hydrated: boolean
  mode: ChainMode
  chain: Chain
  chainId: number
  rpcUrl: string
  /** The contracts for the active chain. Null in live mode until Intatto is deployed on X Layer. */
  deployment: Deployment | null
  sandbox: SandboxSession | null
  /** Set when a stored sandbox session exists but no longer parses; the app then runs live. */
  sandboxError: string | null
  publicClient: PublicClient<Transport, Chain>
  /** OKLink URL in live mode; null in sandbox mode (a fork has no explorer). */
  explorerTxUrl(hash: string): string | null
  explorerAddressUrl(address: string): string | null
  /** Stores the session and switches every screen to the fork. */
  startSandbox(session: SandboxSession): void
  /** Forgets the session and returns to X Layer mainnet. */
  endSandbox(): void
}

const IntattoContext = createContext<IntattoChain | null>(null)

function subscribeSandbox(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SANDBOX_STORAGE_KEY) onChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(SANDBOX_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(SANDBOX_CHANGE_EVENT, onChange)
  }
}

function readRawSandbox(): string | null {
  try {
    return window.localStorage.getItem(SANDBOX_STORAGE_KEY)
  } catch {
    return null
  }
}

const noSubscribe = () => () => {}

function parseSandbox(raw: string | null): { session: SandboxSession | null; error: string | null } {
  if (!raw) return { session: null, error: null }
  try {
    const parsed = sandboxSessionSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return { session: parsed.data, error: null }
    const issue = parsed.error.issues[0]
    return { session: null, error: issue ? `${issue.path.join(".") || "session"}: ${issue.message}` : "invalid session" }
  } catch {
    return { session: null, error: "stored session is not valid JSON" }
  }
}

/**
 * The one chain context: live X Layer mainnet, or a sandbox fork when a session is stored.
 * Switching mode rebuilds the wagmi config, clients and query cache and remounts the tree below.
 * wagmi hooks are available only once `hydrated` is true (inside <ChainReady>, or after checking it).
 */
export function IntattoChainProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)
  const raw = useSyncExternalStore(subscribeSandbox, readRawSandbox, () => null)
  // Used only when localStorage refuses the write (blocked storage): the session lives until reload.
  const [memory, setMemory] = useState<SandboxSession | null | undefined>(undefined)

  const stored = useMemo(() => parseSandbox(raw), [raw])
  const sandbox = memory !== undefined ? memory : stored.session
  const sandboxError = memory !== undefined ? null : stored.error
  const runtime = useMemo(() => buildRuntime(sandbox), [sandbox])
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } } }),
    // A fresh cache per chain, so no screen shows numbers read from the other chain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime.key],
  )

  const startSandbox = useCallback((session: SandboxSession) => {
    setMemory(writeSandboxSession(session) ? undefined : session)
  }, [])
  const endSandbox = useCallback(() => {
    clearSandboxSession()
    setMemory(undefined)
  }, [])

  const value = useMemo<IntattoChain>(() => {
    const live = runtime.mode === "live"
    return {
      hydrated,
      mode: runtime.mode,
      chain: runtime.chain,
      chainId: runtime.chain.id,
      rpcUrl: runtime.rpcUrl,
      deployment: runtime.deployment,
      sandbox,
      sandboxError,
      publicClient: runtime.publicClient,
      explorerTxUrl: (hash) => (live ? explorerTx(hash) : null),
      explorerAddressUrl: (address) => (live ? explorerAddress(address) : null),
      startSandbox,
      endSandbox,
    }
  }, [hydrated, runtime, sandbox, sandboxError, startSandbox, endSandbox])

  const inner = <IntattoContext.Provider value={value}>{children}</IntattoContext.Provider>
  // No wagmi until the mode is known: mounting the live config first would start a reconnect that
  // blocks the sandbox config's reconnect (wagmi allows one at a time). Wallet UI waits for `hydrated`.
  if (!hydrated) return <QueryClientProvider client={queryClient}>{inner}</QueryClientProvider>
  return (
    <WagmiProvider key={runtime.key} config={runtime.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {runtime.mode === "sandbox" ? <BurnerAutoConnect /> : null}
        {inner}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export function useIntatto(): IntattoChain {
  const ctx = useContext(IntattoContext)
  if (!ctx) throw new Error("useIntatto must be used inside <IntattoChainProvider>")
  return ctx
}

/** Renders `fallback` until the chain mode is known on the client, then the children. */
export function ChainReady({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { hydrated } = useIntatto()
  return <>{hydrated ? children : fallback}</>
}
