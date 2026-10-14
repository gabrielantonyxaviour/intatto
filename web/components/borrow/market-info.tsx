"use client"

import Link from "next/link"
import type { Session } from "@intatto/config/session"
import { TriangleAlertIcon } from "lucide-react"
import { type MarketState } from "@/lib/chain"
import { Badge } from "@/components/ui/badge"
import { DefinitionPopover } from "@/components/ui/ix"
import { sessionMeaning } from "./format"
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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" data-testid="market-status">
      <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
      <span>New borrowing is paused</span>
      <DefinitionPopover term="borrowing paused">
        <p>Because {reasons.join("; ")}.</p>
        <p>Repaying and adding collateral still work. Withdrawals work with no debt.</p>
        <Link href="/risk" className="underline underline-offset-4">See every guard</Link>
      </DefinitionPopover>
    </div>
  )
}
