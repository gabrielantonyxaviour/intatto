"use client"

import Link from "next/link"
import { CheckIcon, XIcon } from "lucide-react"
import type { MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { DefinitionPopover } from "@/components/ui/ix"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { guardResults, type MarketTerms } from "./copy"
import { relativeTime } from "./format"
import type { RelayDetail } from "./use-market-params"

type Props = { symbol: string; state: MarketState; relay: RelayDetail | undefined; relayFailed: boolean; now: number; terms: MarketTerms | undefined }

export function GuardList({ symbol, state, relay, relayFailed, now, terms }: Props) {
  const guards = guardResults(state, relay, now, symbol, relayFailed, terms?.twapWindowSeconds)
  const failing = guards.filter((g) => !g.ok)
  const reasons: Record<string, string> = {
    fresh: state.priceE18 === 0n ? "No keeper price posted yet." : `Keeper price is stale; fetched ${relativeTime(now, state.fetchedAt)}.`,
    inBand: "Price is outside the allowed pool band or the TWAP is unavailable.",
    pegOk: "USDG peg is outside its allowed band or the feed is stale.",
    corporateAction: "A split or dividend is activating; borrowing and liquidation are paused.",
    issuerPause: `The issuer has paused ${symbol} or its wrapper.`,
  }
  return (
    <div data-testid="guards" className="grid gap-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <h3 className="font-medium">Borrowing checks</h3>
        <DefinitionPopover term="Guards" contentTestId="guards-meaning">Checks cover keeper price freshness, the pool TWAP band, the USDG peg, corporate actions and issuer pauses. Session limits and caps also apply.</DefinitionPopover>
        <span className="ml-auto">{guards.length - failing.length}/{guards.length} passing</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {guards.map((g) => <li key={g.key} data-testid={`guard-${g.key}`} data-ok={g.ok ? "true" : "false"}>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={`About ${g.label}: ${g.ok ? "passes" : "fails"}`} className={cn("flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", !g.ok && "border-warning/40 bg-warning/5")}>
                {g.ok ? <CheckIcon aria-hidden className="size-3.5 text-muted-foreground" /> : <XIcon aria-hidden className="size-3.5 text-warning" />}{g.label}
              </button>
            </PopoverTrigger>
            <PopoverContent data-testid={`guard-${g.key}-meaning`}><h4 className="font-medium">{g.label} · {g.ok ? "passes" : "fails"}</h4><p className="text-xs leading-relaxed">{g.reason}</p></PopoverContent>
          </Popover>
        </li>)}
      </ul>
      {failing.length > 0 ? <ul className="grid gap-1 text-xs leading-relaxed text-muted-foreground">{failing.map((g) => <li key={g.key}>{reasons[g.key]}</li>)}</ul> : null}
      <Link href="/risk" data-testid="guards-risk-link" className="w-fit text-xs text-muted-foreground underline underline-offset-4">View risk & check history</Link>
    </div>
  )
}
