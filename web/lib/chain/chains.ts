import { defineChain, fallback, http, type Chain, type Transport } from "viem"
import { xLayer as viemXLayer } from "viem/chains"
import { SANDBOX_CHAIN_ID, XLAYER_CHAIN_ID, XLAYER_RPC_FALLBACKS } from "@intatto/config/xlayer"

/** RPC endpoints for X Layer mainnet: an optional build-time override first, then the public fallbacks. */
export const LIVE_RPC_URLS: readonly string[] = (() => {
  const configured = process.env.NEXT_PUBLIC_XLAYER_RPC_URL?.trim()
  return configured
    ? [configured, ...XLAYER_RPC_FALLBACKS.filter((u) => u !== configured)]
    : [...XLAYER_RPC_FALLBACKS]
})()

/** X Layer mainnet (chain 196) with Intatto's RPC list. */
export const xLayer: Chain = {
  ...viemXLayer,
  id: XLAYER_CHAIN_ID,
  name: "X Layer",
  rpcUrls: { default: { http: [...LIVE_RPC_URLS] } },
}

/** A local or hosted fork of X Layer mainnet. It uses its own chain id so nothing signed there replays on 196. */
export function sandboxChain(rpcUrl: string, chainId: number = SANDBOX_CHAIN_ID): Chain {
  return defineChain({
    id: chainId,
    name: "Intatto sandbox",
    nativeCurrency: viemXLayer.nativeCurrency,
    rpcUrls: { default: { http: [rpcUrl] } },
    contracts: viemXLayer.contracts,
    testnet: true,
  })
}

/** Transport for X Layer mainnet: every RPC in order, falling through on failure. */
export function liveTransport(): Transport {
  return fallback(LIVE_RPC_URLS.map((url) => http(url, { batch: true })))
}

export function sandboxTransport(rpcUrl: string): Transport {
  return http(rpcUrl, { batch: true })
}
