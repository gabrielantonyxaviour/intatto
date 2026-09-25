"use client"

import { useIntatto } from "./context"
import type { ChainMode } from "./runtime"

export type PriceProvenance = { short: string; detail: string }

export function priceProvenance(mode: ChainMode): PriceProvenance {
  if (mode === "sandbox") return {
    short: "Simulated keeper post (sandbox)",
    detail: "In the sandbox the keeper posts a price derived from the forked wNVDAx/USDG pool (and replay scenarios override it); it is not the live issuer quote.",
  }
  if (mode !== "live") throw new Error("Unknown price provenance mode")
  return {
    short: "Keeper relay of the issuer quote",
    detail: "The keeper relays the xStocks issuer's indicative quote; no source timestamp; bounded onchain by pool TWAP bands, maximum price movement, fetch age, keeper liveness and USDG peg checks. Read current bounds from the active deployment.",
  }
}

export function usePriceProvenance(): PriceProvenance {
  return priceProvenance(useIntatto().mode)
}
