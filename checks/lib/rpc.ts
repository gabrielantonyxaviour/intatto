/**
 * X Layer RPC access for checks and services: the configured URL first, then the public fallbacks.
 */
import { createPublicClient, fallback, http, type Chain, type PublicClient } from "viem"
import { xLayer } from "viem/chains"
import { xlayerRpcUrls } from "@intatto/config/xlayer"

export function xlayerClient(): PublicClient {
  return createPublicClient({
    chain: xLayer as Chain,
    transport: fallback(xlayerRpcUrls().map((url) => http(url, { retryCount: 2, timeout: 20_000 }))),
  }) as PublicClient
}

export function localClient(rpcUrl: string, chainId: number): PublicClient {
  const chain = { ...xLayer, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } } as Chain
  return createPublicClient({ chain, transport: http(rpcUrl, { timeout: 60_000 }) }) as PublicClient
}

/** Fail a check with a readable line and a non-zero exit. */
export function fail(message: string): never {
  process.stderr.write(`FAIL ${message}\n`)
  process.exit(1)
}

export function pass(message: string) {
  process.stdout.write(`ok   ${message}\n`)
}
