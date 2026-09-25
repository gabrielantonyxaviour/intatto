"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import type { MarketDeployment } from "@intatto/config/deployments"
import { usePriceProvenance, type MarketState } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { Button } from "@/components/ui/button"
import { RELAY_BOUNDS_LEAD, RELAY_DISCLOSURE, type MarketTerms } from "./copy"
import { SessionBadge } from "./session-badge"
import { ago, borrowHref, bpsShort, duration, formatUtc, usdPrice, usdg } from "./format"

type Props = {
  market: MarketDeployment
  state: MarketState
  terms: MarketTerms | undefined
  now: number | undefined
}

function Chip({ testId, label, value, term, children }: { testId: string; label: string; value: string; term: string; children: ReactNode }) {
  return (
    <span data-testid={testId} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium tabular-nums">{value}</span>
      <DefinitionPopover term={term} contentTestId={`${testId}-tooltip`} side="bottom">
        {children}
      </DefinitionPopover>
    </span>
  )
}

/** Title, actions, the price and relay that stay visible, and the three one-click definitions. */
export function DetailHeader({ market, state: s, terms, now }: Props) {
  const source = usePriceProvenance()
  const noPrice = s.priceE18 === 0n
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id="market-detail-title" className="text-xl font-semibold">
            {market.symbol} market
          </h2>
          <SessionBadge session={s.session} size="lg" />
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/lend">Lend USDG</Link>
          </Button>
          <Button asChild>
            <Link href={borrowHref(market.symbol)}>Borrow USDG</Link>
          </Button>
        </div>
      </div>
      <p className="text-sm">
        {noPrice ? (
          <span data-testid="price-value">No price posted yet</span>
        ) : (
          <>
            <span data-testid="price-value" className="font-medium tabular-nums">
              {usdPrice(s.priceE18)}
            </span>{" "}
            per {market.symbol}, fetched by the keeper at <span data-testid="price-fetched-at">{formatUtc(s.fetchedAt)}</span>
          </>
        )}
      </p>
      <p data-testid="relay-disclosure" className="text-sm text-muted-foreground">
        {RELAY_DISCLOSURE}
        {source.short === RELAY_DISCLOSURE ? "" : ` · ${source.short}`}
      </p>
      {!s.fresh ? <p className="text-sm text-destructive">The accepted price is stale.</p> : null}
      {s.priceE18 > 0n && !s.inBand ? (
        <p className="text-sm text-destructive">The relayed price is outside the band. The accepted price above is unchanged.</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Chip testId="chip-price" label="Price" term="Price" value={noPrice ? "not posted" : usdPrice(s.priceE18)}>
          {noPrice ? (
            <span>The keeper has not posted a {market.symbol} price to this market yet.</span>
          ) : (
            <span>
              Fetched by the keeper at {formatUtc(s.fetchedAt)}
              {now ? ` (${ago(now, s.fetchedAt)})` : ""}. That is when the keeper fetched it. The quote has no source timestamp.
            </span>
          )}
        </Chip>
        <Chip testId="chip-relay" label="Relay" term="Relay" value={source.short}>
          <span className="grid gap-1.5">
            <span>{RELAY_BOUNDS_LEAD}.</span>
            <span>{source.detail}</span>
            {market.symbol === "SPYx" ? <span>This is the SPYx market and its wSPYx/USDG pool, not the NVDAx pool.</span> : null}
            {terms ? (
              <span>
                Liveness {duration(terms.priceLivenessSeconds)}; band ±{bpsShort(terms.bandOpenBps)} open, ±
                {bpsShort(terms.bandOtherBps)} otherwise; max move {bpsShort(terms.maxMoveBps)} per update; peg within{" "}
                {bpsShort(terms.pegBps)}. Keeper session posts lapse after {duration(terms.sessionLivenessSeconds)}.
              </span>
            ) : (
              <span>Reading the bounds from the active deployment…</span>
            )}
          </span>
        </Chip>
        <Chip testId="chip-liquidation" label="Liquidation" term="Liquidation" value={terms ? `bounded slices · ${bpsShort(terms.penaltyBps)} penalty` : "bounded slices"}>
          <span className="grid gap-1.5">
            <span>Liquidation: bounded slices while the market is closed.</span>
            {terms ? (
              <span>
                A loan can be liquidated once its LTV passes {bpsShort(s.liquidationThresholdBps)}. While the market is closed, each
                slice sells {s.sliceUsdg > 0n ? `at most ${usdg(s.sliceUsdg)} of` : "a keeper-sized amount of"} w{market.symbol} into the
                pool, no lower than {bpsShort(terms.liqClosedFloorBps)} under the relayed price. After{" "}
                {duration(terms.liqClosedTimeoutSeconds)} the floor widens to {bpsShort(terms.liqClosedTimeoutFloorBps)}. In open and
                extended hours the floor is {bpsShort(terms.liqOpenFloorBps)} under. The penalty is {bpsShort(terms.penaltyBps)} of the
                debt repaid.
              </span>
            ) : (
              <span>Reading the liquidation bounds from the active deployment…</span>
            )}
          </span>
        </Chip>
      </div>
    </div>
  )
}
