"use client"

import Link from "next/link"
import type { MarketDeployment } from "@intatto/config/deployments"
import type { MarketState } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InfoChip } from "./info-chip"
import { SessionBadge } from "./session-badge"
import { RELAY_TOOLTIP } from "./copy"
import type { ProtocolParams, RelayDetail } from "./use-market-params"
import { ago, borrowHref, bpsShort, duration, formatUtc, usdPrice, usdg } from "./format"

type Props = {
  market: MarketDeployment
  state: MarketState
  relay: RelayDetail | undefined
  params: ProtocolParams | undefined
  now: number | undefined
}

/** The selected market's title, session and the three explained chips: price, relay, liquidation style. */
export function DetailHeader({ market, state: s, relay, params, now }: Props) {
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
      <div className="flex flex-wrap gap-2">
        <InfoChip testId="chip-price" label="Price" value={noPrice ? "not posted" : usdPrice(s.priceE18)}>
          {noPrice ? (
            <span>The keeper has not posted a {market.symbol} price to this market yet.</span>
          ) : (
            <span>
              Fetched by the keeper at {formatUtc(s.fetchedAt)}
              {now ? ` (${ago(now, s.fetchedAt)})` : ""}. The issuer&apos;s quote carries no timestamp of its own, so this is
              when the keeper fetched it, not when the stock last traded.
            </span>
          )}
        </InfoChip>
        <InfoChip testId="chip-relay" label="Relay" value="keeper, bounded onchain">
          <span className="grid gap-1.5">
            <span>{RELAY_TOOLTIP}</span>
            {relay ? (
              <span>
                Liveness {duration(relay.priceLivenessSeconds)}; band ±{bpsShort(relay.bandOpenBps)} open, ±
                {bpsShort(relay.bandOtherBps)} otherwise; max move {bpsShort(relay.maxMoveBps)} per update; peg within{" "}
                {bpsShort(relay.pegBps)}.
              </span>
            ) : null}
          </span>
        </InfoChip>
        {params ? (
          <InfoChip testId="chip-liquidation" label="Liquidation" value={`bounded slices · ${bpsShort(params.penaltyBps)} penalty`}>
            <span className="grid gap-1.5">
              <span>Liquidation: bounded slices while the market is closed.</span>
              <span>
                A loan can be liquidated once its LTV passes {bpsShort(s.liquidationThresholdBps)}. While the market is closed, each
                slice sells {s.sliceUsdg > 0n ? `at most ${usdg(s.sliceUsdg)} of` : "a keeper-sized amount of"} w{market.symbol} into
                the pool{s.sliceUsdg > 0n ? "" : " (the keeper has not posted a size yet, so none can sell)"}, no lower than{" "}
                {bpsShort(params.liqClosedFloorBps)} under the relayed price; a slice that cannot fill waits, and after{" "}
                {duration(params.liqClosedTimeoutSeconds)} the floor widens to {bpsShort(params.liqClosedTimeoutFloorBps)}. In open and
                extended hours the rest sells no lower than {bpsShort(params.liqOpenFloorBps)} under. The penalty is{" "}
                {bpsShort(params.penaltyBps)} of the debt repaid.
              </span>
              <span>
                Example: $1,000 of {market.symbol} backing 700 USDG is at 70% LTV, past {bpsShort(s.liquidationThresholdBps)}, so slices
                sell collateral until the debt plus the penalty is repaid.
              </span>
            </span>
          </InfoChip>
        ) : (
          <Skeleton className="h-7 w-48 rounded-full" />
        )}
      </div>
    </div>
  )
}
