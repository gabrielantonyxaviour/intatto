/**
 * X Layer mainnet: chain, RPC and every external address Intatto depends on.
 * Addresses were read onchain on 2026-09-25 (preflight) and are re-checked by checks/addresses.ts.
 */
import type { Address } from "viem"

export const XLAYER_CHAIN_ID = 196
/** The hosted sandbox fork uses a distinct id so nothing signed there can replay on mainnet. */
export const SANDBOX_CHAIN_ID = 1960196

export const XLAYER_RPC_FALLBACKS = [
  "https://xlayerrpc.okx.com",
  "https://xlayer.drpc.org",
  "https://rpc.xlayer.tech",
] as const

/** eth_getLogs on the public endpoints is capped at roughly 100 blocks per call. */
export const XLAYER_LOGS_BLOCK_SPAN = 100n

export function xlayerRpcUrls(env: Record<string, string | undefined> = readEnv()): string[] {
  const configured = env.XLAYER_RPC_URL?.trim()
  return configured ? [configured, ...XLAYER_RPC_FALLBACKS.filter((u) => u !== configured)] : [...XLAYER_RPC_FALLBACKS]
}

function readEnv(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {}
}

export const EXPLORER_URL = "https://www.oklink.com/x-layer"
export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`

/** A tokenized stock market: the issuer token, its non-rebasing ERC-4626 wrapper and the wrapper/USDG pool. */
export type TickerConfig = {
  symbol: "NVDAx" | "SPYx"
  underlying: string
  token: Address
  wrapper: Address
  pool: Address
  poolFee: number
}

export const TICKERS: Record<TickerConfig["symbol"], TickerConfig> = {
  NVDAx: {
    symbol: "NVDAx",
    underlying: "NVDA",
    token: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
    wrapper: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
    pool: "0x2a2b11730c2b6d99a58034a869dd810d7300a7b2",
    poolFee: 500,
  },
  SPYx: {
    symbol: "SPYx",
    underlying: "SPY",
    token: "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48",
    wrapper: "0xe7e553cd128f0011777323a0b44a7b96ea1cb540",
    pool: "0x07c40850d14064d20eb0afdef9574675392f2c11",
    poolFee: 500,
  },
}

export const XLAYER = {
  chainId: XLAYER_CHAIN_ID,
  usdg: "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8",
  usdgDecimals: 6,
  quoterV2: "0xd1b797d92d87b688193a2b976efc8d577d204343",
  swapRouter02: "0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca",
  uniswapV3Factory: "0x4B2ab38DBF28D31D467aA8993f6c2585981D6804",
  chainlinkUsdgUsd: "0x385C6bDDE06b0E438319bF4ddBfFe51C521ABf3D",
  dataStreamsVerifier: "0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7",
} as const satisfies Record<string, Address | number>

/** Every address checks/addresses.ts requires to hold code on chain 196. */
export function configuredAddresses(): { name: string; address: Address }[] {
  const out: { name: string; address: Address }[] = [
    { name: "USDG", address: XLAYER.usdg },
    { name: "QuoterV2", address: XLAYER.quoterV2 },
    { name: "SwapRouter02", address: XLAYER.swapRouter02 },
    { name: "UniswapV3Factory", address: XLAYER.uniswapV3Factory },
    { name: "Chainlink USDG/USD", address: XLAYER.chainlinkUsdgUsd },
    { name: "Data Streams verifier", address: XLAYER.dataStreamsVerifier },
  ]
  for (const t of Object.values(TICKERS)) {
    out.push({ name: t.symbol, address: t.token })
    out.push({ name: `w${t.symbol}`, address: t.wrapper })
    out.push({ name: `w${t.symbol}/USDG pool`, address: t.pool })
  }
  return out
}

/** xStocks issuer public API (no key; send a browser User-Agent). */
export const ISSUER_API = "https://api.xstocks.fi/api/v2"

/**
 * Real X Layer holders the sandbox and fork checks move existing balances from (by impersonation on a
 * fork only; never minting). Found from recent Transfer logs on 2026-09-25: an EOA holding ~3,976 NVDAx,
 * ~60.8M USDG, ~1,177 SPYx and ~374 OKB. Every transfer from it is written to the divergence ledger.
 */
export const FORK_FUNDING_HOLDER = "0x5075FF68A0Efb54dB13423AD924bd680327D305E" as const

/** The issuer's multiplier updater for NVDAx (read from multiplierUpdater() on 2026-09-25). */
export const NVDAX_MULTIPLIER_UPDATER = "0x5F7A4c11bde4f218f0025Ef444c369d838ffa2aD" as const
