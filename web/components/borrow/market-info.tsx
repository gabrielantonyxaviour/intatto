"use client"

import Link from "next/link"
import type { Session } from "@intatto/config/session"
import { TriangleAlertIcon } from "lucide-react"
import { useProtocolParams, usePriceProvenance, type MarketState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { DefinitionPopover } from "@/components/ui/ix"
import { formatUtc } from "@/components/ui/web3/format"
import { pct, price, sessionMeaning, shortUtc } from "./format"
import { useNames } from "./names"

const SESSION_BADGE: Record<Session, "success-light" | "info-light" | "warning-light" | "destructive-light"> = {
  OPEN: "success-light",
  EXTENDED: "info-light",
  CLOSED: "warning-light",
  HALTED: "destructive-light",
  CORPORATE_ACTION: "destructive-light",
  UNKNOWN: "destructive-light",
}

export function SessionBadge({ session }: { session: Session }) {
  return (
    <Badge variant={SESSION_BADGE[session]} size="lg" data-testid="session-badge" title={sessionMeaning(session)}>
      {session}
    </Badge>
  )
}

/** Consequence line under the collateral field: the relayed price and the session's new-borrow limit. */
export function CollateralLine({ m, decay }: { m: MarketState; decay: { floorBps: bigint; duration: number } | null }) {
  const { token, symbol } = useNames()
  const { data: params } = useProtocolParams(symbol)
  const provenance = usePriceProvenance()
  const floorAt = decay ? m.periodChangedAt + decay.duration : null
  return (
    <div className="grid gap-1 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
      <span className="flex flex-wrap items-center gap-x-1.5">
        {token} price <span className="font-medium text-foreground tabular-nums" data-testid="relayed-price">{price(m.priceE18)}</span>
        <span>· fetched by the keeper at {formatUtc(m.fetchedAt)}</span>
        <DefinitionPopover term="this price" source={params ? `Bounds read at block ${params.blockNumber}` : "Parameter reads unavailable or loading"}>
          {provenance.detail.replace("wNVDAx/USDG", `w${token}/USDG`)} {params ? `Keeper post liveness: ${Number(params.relay.priceLiveness) / 60} minutes. Pool TWAP window: ${Number(params.relay.twapWindow) / 60} minutes.` : "Price bounds unavailable."}
        </DefinitionPopover>
      </span>
      <span data-testid="borrow-price-source">{provenance.short}</span>
      <span className="flex flex-wrap items-center gap-x-1.5">
        {m.session} session · max new-borrow LTV{" "}
        <span className="font-medium text-foreground tabular-nums" data-testid="session-max-ltv">
          {pct(m.maxLtvBps)}
        </span>
        {m.session === "CLOSED" && decay && floorAt ? <span>· falls to {pct(decay.floorBps)} by {shortUtc(floorAt)}</span> : null}
        <span>· liquidation at {pct(m.liquidationThresholdBps)}</span>
        <DefinitionPopover term="session limits" source={params ? `SessionRiskController · block ${params.blockNumber}` : undefined}>
          {params ? `New-borrow LTV: OPEN ${pct(params.session.openBps)}, EXTENDED ${pct(params.session.extendedBps)}, CLOSED ${pct(params.session.closedStartBps)} falling to ${pct(params.session.closedFloorBps)} over ${Number(params.session.closedDecayDuration) / 3600} hours. Liquidation threshold: ${pct(params.market.liquidationThresholdBps)}.` : "Session schedule parameters are unavailable or loading. The current session limit above comes from the market read."}
        </DefinitionPopover>
        <Link href="/risk" className="underline underline-offset-4 hover:text-foreground" data-testid="risk-link">
          Sessions, guards and caps on the Risk page
        </Link>
      </span>
    </div>
  )
}

/** Why new borrowing is off right now, and what still works. Null when every guard passes. */
export function MarketStatusAlert({ m }: { m: MarketState }) {
  const { token, underlying } = useNames()
  const reasons: string[] = []
  if (m.issuerPaused) reasons.push(`the token issuer has paused ${token}`)
  if (m.corporateActionPaused) reasons.push("a split or dividend is being applied")
  if (m.session === "UNKNOWN") reasons.push("the keeper's session post is missing or outside its liveness limit")
  if (m.session === "HALTED") reasons.push(`trading in ${underlying} is halted`)
  if (m.session === "CORPORATE_ACTION" && !m.corporateActionPaused) reasons.push("the keeper reports a corporate action in progress")
  if (!m.fresh) reasons.push("the keeper's last price post is outside its liveness limit")
  if (!m.inBand) reasons.push("the relayed price is outside the permitted band around the pool average")
  if (!m.pegOk) reasons.push("USDG is off its $1 peg or its feed is stale")
  if (reasons.length === 0) return null
  return (
    <Alert variant="warning" data-testid="market-status">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>New borrowing is paused</AlertTitle>
      <AlertDescription>
        <p>Because {reasons.join("; ")}.</p>
        <p>
          Repaying always works. Adding collateral works too, and withdrawing does when you have no debt.{" "}
          <Link href="/risk" className="underline underline-offset-4">
            See every guard on the Risk page
          </Link>
          .
        </p>
      </AlertDescription>
    </Alert>
  )
}
