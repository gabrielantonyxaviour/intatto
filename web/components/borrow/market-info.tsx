"use client"

import type { Session } from "@intatto/config/session"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"
import type { MarketState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatUtc } from "@/components/ui/web3/format"
import { pct, price, sessionMeaning, shortUtc } from "./format"

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

function Hint({ label, children }: { label: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className="inline-flex text-muted-foreground hover:text-foreground">
          <InfoIcon aria-hidden className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{children}</TooltipContent>
    </Tooltip>
  )
}

/** Consequence line under the collateral field: the relayed price and the session's new-borrow limit. */
export function CollateralLine({ m, decay }: { m: MarketState; decay: { floorBps: bigint; duration: number } | null }) {
  const floorAt = decay ? m.periodChangedAt + decay.duration : null
  return (
    <div className="grid gap-1 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
      <span className="flex flex-wrap items-center gap-x-1.5">
        NVDAx price <span className="font-medium text-foreground tabular-nums" data-testid="relayed-price">{price(m.priceE18)}</span>
        <span>· fetched by the keeper at {formatUtc(m.fetchedAt)}</span>
        <Hint label="About this price">
          The issuer's indicative quote, relayed onchain by Intatto's keeper. The quote carries no source timestamp, so
          this is when the keeper fetched it, not a market-price time. The contract refuses it if the post is older than
          30 minutes or strays from the pool's 30-minute average.
        </Hint>
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5">
        {m.session} session · max new-borrow LTV{" "}
        <span className="font-medium text-foreground tabular-nums" data-testid="session-max-ltv">
          {pct(m.maxLtvBps)}
        </span>
        {m.session === "CLOSED" && decay && floorAt ? <span>· falls to {pct(decay.floorBps)} by {shortUtc(floorAt)}</span> : null}
        <Hint label="About session limits">
          New loans may reach 50% LTV while the US market is open, 40% in extended hours and 30% falling to 20% over a
          closed weekend. Liquidation stays at 65% LTV in every session.
        </Hint>
      </span>
    </div>
  )
}

/** Why new borrowing is off right now, and what still works. Null when every guard passes. */
export function MarketStatusAlert({ m }: { m: MarketState }) {
  const reasons: string[] = []
  if (m.issuerPaused) reasons.push("the token issuer has paused NVDAx")
  if (m.corporateActionPaused) reasons.push("a split or dividend is being applied")
  if (m.session === "UNKNOWN") reasons.push("the keeper's session post is missing or older than 30 minutes")
  if (m.session === "HALTED") reasons.push("trading in NVDA is halted")
  if (m.session === "CORPORATE_ACTION" && !m.corporateActionPaused) reasons.push("the keeper reports a corporate action in progress")
  if (!m.fresh) reasons.push("the keeper's last price post is older than 30 minutes")
  if (!m.inBand) reasons.push("the relayed price is outside the band around the pool's 30-minute average")
  if (!m.pegOk) reasons.push("USDG is off its $1 peg or its feed is stale")
  if (reasons.length === 0) return null
  return (
    <Alert variant="warning" data-testid="market-status">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>New borrowing is paused</AlertTitle>
      <AlertDescription>
        <p>Because {reasons.join("; ")}.</p>
        <p>Repaying always works. Adding collateral works too, and withdrawing does when you have no debt.</p>
      </AlertDescription>
    </Alert>
  )
}
