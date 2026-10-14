"use client"

import Link from "next/link"
import type { MarketState, ProtocolParams } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { cn } from "@/lib/utils"
import { pct } from "./format"

export function SessionSchedule({ m, params }: { m: MarketState; params?: ProtocolParams }) {
  const s = params?.session
  const rows = [
    { session: "OPEN", label: "Open", value: s ? pct(s.openBps) : "—" },
    { session: "EXTENDED", label: "Extended", value: s ? pct(s.extendedBps) : "—" },
    { session: "CLOSED", label: "Closed", value: s ? `${pct(s.closedStartBps)} → ${pct(s.closedFloorBps)}` : "—" },
  ]
  return <section className="grid gap-3 border-t pt-5" aria-label="Session borrowing limits">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-medium">What changes when the market closes</h3>
      <DefinitionPopover term="session borrowing limits" source={params ? `SessionRiskController · block ${params.blockNumber}` : undefined}>
        {s ? `The closed-session limit falls over ${Number(s.closedDecayDuration) / 3600} hours.` : "Session schedule parameters are loading or unavailable."}
        {" "}A lower limit reduces new borrowing and withdrawals with debt. It does not itself liquidate your position.
      </DefinitionPopover>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {rows.map((row) => <div key={row.session} aria-current={m.session === row.session ? "true" : undefined}
        className={cn("grid content-start gap-1 rounded-lg px-2 py-3 sm:px-3", m.session === row.session ? "bg-foreground text-background" : "bg-muted/50")}>
        <span className={cn("text-xs", m.session === row.session ? "text-background/75" : "text-muted-foreground")}>{row.label}{m.session === row.session ? " · now" : ""}</span>
        <span className="text-sm font-semibold tabular-nums sm:text-base">{row.value}</span>
      </div>)}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">
      New-borrow limits change; liquidation stays at {pct(m.liquidationThresholdBps)}.
      {m.maxLtvBps === 0n ? " New borrowing is currently paused." : ""}{" "}
      <Link href="/risk" className="underline underline-offset-4 hover:text-foreground" data-testid="risk-link">See all limits</Link>
    </p>
  </section>
}
