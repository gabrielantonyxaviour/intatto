"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { TICKERS } from "@intatto/config/xlayer"
import { useIntatto, type MarketSymbol } from "@/lib/chain"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type MarketSelection = {
  symbol: MarketSymbol
  /** Every market in the active deployment (NVDAx on X Layer; the sandbox may add SPYx). */
  available: MarketSymbol[]
  /** `?market=` named a market this deployment does not have. */
  unknown: string | null
}

/** The market from `?market=` (case-insensitive), NVDAx by default, limited to the active deployment's markets. */
export function useSelectedMarket(): MarketSelection {
  const { deployment } = useIntatto()
  const params = useSearchParams()
  const requested = params?.get("market")?.trim() || null
  const available = (deployment?.markets ?? []).map((m) => m.symbol)
  const match = requested ? available.find((s) => s.toLowerCase() === requested.toLowerCase()) : undefined
  const fallback: MarketSymbol = available.includes("NVDAx") ? "NVDAx" : (available[0] ?? "NVDAx")
  return { symbol: match ?? fallback, available, unknown: requested && !match ? requested : null }
}

/** Visible market picker; writes the choice back to `?market=` so the page can be linked and reloaded. */
export function MarketSelect({ symbol, available }: { symbol: MarketSymbol; available: MarketSymbol[] }) {
  const router = useRouter()
  const pathname = usePathname() ?? "/borrow"
  const params = useSearchParams()
  if (available.length === 0) return null
  return (
    <Select
      value={symbol}
      onValueChange={(next) => {
        const q = new URLSearchParams(params?.toString() ?? "")
        q.set("market", next)
        router.replace(`${pathname}?${q.toString()}`, { scroll: false })
      }}
    >
      <SelectTrigger size="sm" aria-label="Market" data-testid="market-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {available.map((s) => (
          <SelectItem key={s} value={s}>
            {s} · {TICKERS[s].underlying}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
