"use client"

import { createContext, useContext, type ReactNode } from "react"
import { TICKERS } from "@intatto/config/xlayer"
import type { MarketSymbol } from "@/lib/chain"
import { formatTokenAmount } from "@/components/ui/web3/format"

/** How the selected market's assets are named on screen: NVDAx / wNVDAx / NVDA, or SPYx / wSPYx / SPY. */
export type Names = {
  symbol: MarketSymbol
  token: string
  wrapper: string
  underlying: string
  /** 10.1234 NVDAx */
  tokens: (x: bigint) => string
  /** 9.9876 wNVDAx */
  shares: (x: bigint) => string
}

export function namesFor(symbol: MarketSymbol): Names {
  const wrapper = `w${symbol}`
  const fmt = (x: bigint) => formatTokenAmount(x, 18, { maxFractionDigits: 4 })
  return {
    symbol,
    token: symbol,
    wrapper,
    underlying: TICKERS[symbol].underlying,
    tokens: (x) => `${fmt(x)} ${symbol}`,
    shares: (x) => `${fmt(x)} ${wrapper}`,
  }
}

const NamesContext = createContext<Names>(namesFor("NVDAx"))

export function NamesProvider({ names, children }: { names: Names; children: ReactNode }) {
  return <NamesContext.Provider value={names}>{children}</NamesContext.Provider>
}

export const useNames = () => useContext(NamesContext)
