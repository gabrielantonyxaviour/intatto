import { injected } from "wagmi"
import type { EIP1193Provider } from "viem"

/** OKX Wallet's EIP-6963 rdns; using it as the id stops the discovered copy from being listed twice. */
export const OKX_CONNECTOR_ID = "com.okex.wallet"

/** OKX Wallet's injected provider (window.okxwallet). */
export function okxWallet() {
  return injected({
    target: {
      id: OKX_CONNECTOR_ID,
      name: "OKX Wallet",
      provider: (w) => (w as (Window & { okxwallet?: EIP1193Provider }) | undefined)?.okxwallet,
    },
  })
}

/** Connectors for X Layer mainnet: OKX Wallet first, then any injected browser wallet. EIP-6963 wallets are discovered by the config. */
export function liveConnectors() {
  return [okxWallet(), injected()]
}
