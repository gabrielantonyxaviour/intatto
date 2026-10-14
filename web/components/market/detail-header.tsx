"use client"

import type { MarketDeployment } from "@intatto/config/deployments"
import { usePriceProvenance, type MarketState } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { RELAY_BOUNDS_LEAD, RELAY_DISCLOSURE, type MarketTerms } from "./copy"
import { bpsShort, duration, formatUtc, relativeTime, usdPrice } from "./format"

type Props = { market: MarketDeployment; state: MarketState; terms: MarketTerms | undefined; now: number | undefined }

/** Price provenance stays one click away, without repeating the headline price. */
export function DetailHeader({ market, state: s, terms, now }: Props) {
  const source = usePriceProvenance()
  const noPrice = s.priceE18 === 0n
  return (
    <header className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Market overview</p>
          <h2 id="market-detail-title" className="text-xl font-semibold tracking-tight">{market.symbol}</h2>
          {market.symbol === "SPYx" ? <span className="text-xs text-muted-foreground">Sandbox only</span> : null}
        </div>
        <div className="grid justify-items-end gap-1">
          <span data-testid="chip-price" className="flex items-center gap-1 text-xs text-muted-foreground">
            Relayed price
            <DefinitionPopover term="Price" contentTestId="chip-price-tooltip" side="bottom">
              {noPrice ? `The keeper has not posted a ${market.symbol} price yet.` : `Fetched by the keeper at ${formatUtc(s.fetchedAt)}. This is the keeper fetch time; the quote has no source timestamp.`}
            </DefinitionPopover>
          </span>
          <span data-testid="price-value" className="text-3xl font-semibold tracking-tight tabular-nums">{noPrice ? "—" : usdPrice(s.priceE18)}</span>
          {noPrice ? <span className="text-xs text-muted-foreground">No price posted yet</span> : <time data-testid="price-fetched-at" dateTime={new Date(s.fetchedAt * 1000).toISOString()} title={formatUtc(s.fetchedAt)} className="text-xs text-muted-foreground">Fetched {now !== undefined ? relativeTime(now, s.fetchedAt) : "—"}{!s.fresh ? " · stale" : ""}</time>}
        </div>
      </div>
      <div data-testid="chip-relay" className="flex items-center gap-1 text-xs text-muted-foreground">
        <p data-testid="relay-disclosure">{RELAY_DISCLOSURE}{source.short === RELAY_DISCLOSURE ? "" : ` · ${source.short}`}</p>
        <DefinitionPopover term="Relay" contentTestId="chip-relay-tooltip" side="bottom">
          <div className="grid gap-2">
            <p>{RELAY_BOUNDS_LEAD}.</p><p>{source.detail}</p>
            {market.symbol === "SPYx" ? <p>Uses the SPYx market and wSPYx/USDG pool.</p> : null}
            {terms ? <p>Liveness {duration(terms.priceLivenessSeconds)}; band ±{bpsShort(terms.bandOpenBps)} open, ±{bpsShort(terms.bandOtherBps)} otherwise; max move {bpsShort(terms.maxMoveBps)} per update; peg within {bpsShort(terms.pegBps)}. Session posts lapse after {duration(terms.sessionLivenessSeconds)}.</p> : <p>Reading relay bounds…</p>}
          </div>
        </DefinitionPopover>
      </div>
    </header>
  )
}
