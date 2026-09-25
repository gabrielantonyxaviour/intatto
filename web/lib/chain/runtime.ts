import { createConfig, createStorage, noopStorage, type Config } from "wagmi"
import { createPublicClient, type Chain, type PublicClient, type Transport } from "viem"
import type { Deployment } from "@intatto/config/deployments"
import { LIVE_RPC_URLS, liveTransport, sandboxChain, sandboxTransport, xLayer } from "./chains"
import { liveDeployment } from "./deployment"
import { liveConnectors } from "./connectors"
import { sandboxBurner } from "./burner"
import type { SandboxSession } from "./sandbox-session"

export type ChainMode = "live" | "sandbox"

/** Everything that changes when the app moves between X Layer mainnet and a sandbox fork. */
export type ChainRuntime = {
  /** Changes whenever the wagmi config must be rebuilt. */
  key: string
  mode: ChainMode
  chain: Chain
  rpcUrl: string
  deployment: Deployment | null
  publicClient: PublicClient<Transport, Chain>
  wagmiConfig: Config
}

/** localStorage for wagmi, with every access guarded (private windows and blocked storage throw). */
const guardedStorage = {
  getItem(key: string) {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value)
    } catch {
      // storage blocked: the connection simply won't be remembered
    }
  },
  removeItem(key: string) {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(key)
    } catch {
      // storage blocked: nothing to remove
    }
  },
}

function wagmiStorage(key: string) {
  return createStorage({ key, storage: typeof window === "undefined" ? noopStorage : guardedStorage })
}

export function buildRuntime(sandbox: SandboxSession | null): ChainRuntime {
  if (sandbox) {
    const chain = sandboxChain(sandbox.rpcUrl, sandbox.chainId)
    const transport = sandboxTransport(sandbox.rpcUrl)
    return {
      key: `sandbox:${sandbox.sessionId}:${sandbox.chainId}:${sandbox.rpcUrl}`,
      mode: "sandbox",
      chain,
      rpcUrl: sandbox.rpcUrl,
      deployment: sandbox.deployment,
      publicClient: createPublicClient({ chain, transport }),
      wagmiConfig: createConfig({
        chains: [chain],
        transports: { [chain.id]: transport },
        connectors: [sandboxBurner(sandbox)],
        multiInjectedProviderDiscovery: false,
        ssr: true,
        storage: wagmiStorage("intatto.wagmi.sandbox"),
      }),
    }
  }
  const transport = liveTransport()
  return {
    key: "live",
    mode: "live",
    chain: xLayer,
    rpcUrl: LIVE_RPC_URLS[0]!,
    deployment: liveDeployment,
    publicClient: createPublicClient({ chain: xLayer, transport }),
    wagmiConfig: createConfig({
      chains: [xLayer],
      transports: { [xLayer.id]: transport },
      connectors: liveConnectors(),
      multiInjectedProviderDiscovery: true,
      ssr: true,
      storage: wagmiStorage("intatto.wagmi.live"),
    }),
  }
}
