"use client"

import { CircleAlertIcon } from "lucide-react"
import type { MarketState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SessionBadge } from "./session-badge"
import { SESSION_LABEL, pausedSentence, refusalsFor, sessionMeaning } from "./copy"
import type { ProtocolParams, RelayDetail } from "./use-market-params"
import { bps, bpsShort, formatUtc } from "./format"

function Tile({ id, label, value, note }: { id: string; label: string; value: string; note: string }) {
  return (
    <div data-testid={`tile-${id}`} className="grid gap-0.5 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span data-slot="value" className="text-lg font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  )
}

type Props = {
  symbol: string
  state: MarketState
  params: ProtocolParams | undefined
  relay: RelayDetail | undefined
  now: number | undefined
}

/** The session in force, what it means now, the three limits, and why new borrowing is off when it is. */
export function SessionPanel({ symbol, state: s, params, relay, now }: Props) {
  const refusals = refusalsFor(s)
  return (
    <Card data-testid="session-panel">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Market session
          <span data-testid="session-value" data-session={s.session}>
            <SessionBadge session={s.session} size="lg" />
          </span>
          <span className="text-sm font-normal text-muted-foreground">{SESSION_LABEL[s.session]}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {params && now !== undefined ? (
          <p data-testid="session-meaning" className="text-sm leading-relaxed">
            {sessionMeaning(s, params, relay, now)}
          </p>
        ) : (
          <Skeleton className="h-10" />
        )}
        {s.sessionPostedAt > 0 ? (
          <p className="text-xs text-muted-foreground">
            Posted by the keeper at {formatUtc(s.sessionPostedAt)}
            {s.periodChangedAt > 0 ? `; this period began ${formatUtc(s.periodChangedAt)}` : ""}.
          </p>
        ) : null}

        {refusals.length > 0 ? (
          <Alert variant="warning" data-testid="borrowing-off">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>New borrowing is off</AlertTitle>
            <AlertDescription>
              <p>{pausedSentence(refusals[0]!, s, symbol)}</p>
              {refusals.length > 1 ? (
                <p>
                  {refusals.length === 2 ? "1 more check also refuses it" : `${refusals.length - 1} more checks also refuse it`}; see the
                  guards below.
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Tile
            id="max-ltv"
            label="Max LTV for new loans, now"
            value={bps(s.maxLtvBps)}
            note={s.maxLtvBps === 0n ? "No new loans in this session" : `Set by the ${s.session} session`}
          />
          <Tile id="liq-threshold" label="Liquidation threshold" value={bpsShort(s.liquidationThresholdBps)} note="The same in every session" />
          <Tile
            id="liq-penalty"
            label="Liquidation penalty"
            value={params ? bpsShort(params.penaltyBps) : "…"}
            note="Of the debt a liquidation repays"
          />
        </div>
      </CardContent>
    </Card>
  )
}
