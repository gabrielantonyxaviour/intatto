"use client"

import type { ReactNode } from "react"
import type { MarketState, ProtocolParams } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SessionBadge } from "./session-badge"
import { refusalsFor, sessionMeaning, type MarketTerms } from "./copy"
import { bpsShort, duration, formatUtc, usdgDisplay } from "./format"

function Tile({ id, label, value, children }: { id: string; label: string; value: string; children?: ReactNode }) {
  return <div data-testid={`tile-${id}`} className="grid content-start gap-2"><span className="text-xs text-muted-foreground">{label}</span><span data-slot="value" className="flex items-center gap-1 text-lg font-semibold tabular-nums">{value}{children}</span></div>
}

export function SessionSchedule({ params }: { params: ProtocolParams | undefined }) {
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="ghost" className="text-xs text-muted-foreground">Session schedule</Button></PopoverTrigger>
      <PopoverContent data-testid="session-schedule" className="w-80 max-w-[calc(100vw-2rem)]">
        <h3 className="font-medium">New-loan limits</h3>
        {params ? <>
          <p className="text-xs text-muted-foreground">Closed limits decay from {bpsShort(params.session.closedStartBps)} to {bpsShort(params.session.closedFloorBps)} over {duration(params.session.closedDecayDuration)}.</p>
          <dl className="grid gap-2 text-sm">{(["OPEN", "EXTENDED", "CLOSED"] as const).map((name) => <div key={name} className="flex justify-between gap-2"><dt className="capitalize">{name.toLowerCase()}</dt><dd className="tabular-nums">{bpsShort(params.session.table[name].atZeroBps)} → {bpsShort(params.session.table[name].atDecayBps)}</dd></div>)}</dl>
          <p className="text-xs text-muted-foreground">Start → after closed decay. Limits from this deployment.</p>
        </> : <p>Reading session schedule…</p>}
      </PopoverContent>
    </Popover>
  )
}

type Props = { symbol: string; state: MarketState; terms: MarketTerms | undefined; now: number | undefined }

export function SessionPanel({ symbol, state: s, terms, now }: Props) {
  const refusals = refusalsFor(s)
  return (
    <div data-testid="session-panel" className="grid gap-3 border-y py-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        <div className="grid content-start gap-2">
          <span className="text-xs text-muted-foreground">US market</span>
          <div className="flex items-center gap-1">
            <span data-testid="session-value" data-session={s.session}><SessionBadge session={s.session} /></span>
            <DefinitionPopover term="Market session">
              <div className="grid gap-2 text-xs">
                <p data-testid="session-meaning">{terms && now !== undefined ? sessionMeaning(s, terms, now) : "Reading session rules…"}</p>
                {s.sessionPostedAt > 0 ? <p>Keeper post: {formatUtc(s.sessionPostedAt)}. {s.periodChangedAt > 0 ? `Period began ${formatUtc(s.periodChangedAt)}.` : ""}</p> : null}
              </div>
            </DefinitionPopover>
          </div>
        </div>
        <Tile id="max-ltv" label="Max LTV now" value={bpsShort(s.maxLtvBps)} />
        <Tile id="liq-threshold" label="Liquidation at" value={bpsShort(s.liquidationThresholdBps)} />
        <Tile id="liq-penalty" label="Liquidation penalty" value={terms ? bpsShort(terms.penaltyBps) : "—"}>
          <span data-testid="chip-liquidation">
            <DefinitionPopover term="Liquidation" contentTestId="chip-liquidation-tooltip">
              {terms ? <p className="text-sm font-normal">Liquidation: bounded slices while the market is closed. A loan is liquidatable above {bpsShort(s.liquidationThresholdBps)} LTV. Closed slices sell {s.sliceUsdg > 0n ? `up to ${usdgDisplay(s.sliceUsdg)} of w${symbol}` : "a keeper-sized amount"}, at most {bpsShort(terms.liqClosedFloorBps)} below the relayed price, widening to {bpsShort(terms.liqClosedTimeoutFloorBps)} after {duration(terms.liqClosedTimeoutSeconds)}. Open and extended hours allow {bpsShort(terms.liqOpenFloorBps)} below. Penalty: {bpsShort(terms.penaltyBps)} of debt repaid.</p> : "Reading liquidation bounds…"}
            </DefinitionPopover>
          </span>
        </Tile>
      </div>
      {refusals.length > 0 ? <p data-testid="borrowing-off" className="text-xs text-muted-foreground">New borrowing paused. You can still repay or add collateral.</p> : null}
    </div>
  )
}
