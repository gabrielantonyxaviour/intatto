"use client"

import { useState } from "react"
import { useIntatto, type VaultState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ExplorerLink } from "@/components/ui/web3"
import { bpsText, marketList, usdg } from "./lend-format"

export const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "allocation", label: "Allocation" },
  { id: "rates", label: "Rates" },
  { id: "risk", label: "Risk" },
  { id: "deficits", label: "Deficits" },
  { id: "position", label: "Your position" },
] as const

function Stat({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd data-testid={testId} className="text-2xl font-medium tabular-nums break-words">
        {value}
      </dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  )
}

/** Vault name, identity chips, four headline numbers and the anchored section links. */
export function VaultHero({ vault }: { vault: VaultState }) {
  const { deployment, chain, mode } = useIntatto()
  const lent = vault.totalAssets > vault.idle ? vault.totalAssets - vault.idle : 0n
  const symbols = deployment?.markets.map((m) => m.symbol) ?? []
  const several = symbols.length > 1
  const names = marketList(symbols)
  return (
    <section aria-labelledby="lend-title" className="grid gap-5">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 id="lend-title" className="text-3xl font-semibold tracking-tight">
            Intatto USDG vault
          </h1>
          <Badge variant="secondary">iUSDG</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {deployment ? (
            <span className="inline-flex items-center gap-1">
              Vault <ExplorerLink address={deployment.vault} />
            </span>
          ) : null}
          <span>{mode === "sandbox" ? `${chain.name} (fork of X Layer)` : chain.name}</span>
          <span>Asset USDG</span>
          <span data-testid="lend-markets">{several ? `Lends to ${names}` : `Lends to the ${names} market`}</span>
        </div>
        <p className="max-w-2xl text-muted-foreground" data-testid="lend-intro">
          {several
            ? `Deposit USDG and earn the interest people pay to borrow against ${names}. The vault lends to each of these markets, and borrowing limits follow the US stock market session.`
            : `Deposit USDG and earn the interest people pay to borrow against ${names}. The vault lends to one market, whose borrowing limits follow the US stock market session.`}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Stat label="Total deposits" value={usdg(vault.totalAssets, 0)} testId="stat-total-deposits" />
        <Stat label="Idle, withdrawable now" value={usdg(vault.idle, 0)} testId="stat-idle" />
        <Stat label="Lent out" value={usdg(lent, 0)} sub={`${bpsText(vault.utilizationBps)} utilisation`} />
        <Stat label="Supply rate" value={bpsText(vault.supplyRateBps)} sub="a year, variable" testId="stat-supply-rate" />
      </dl>
    </section>
  )
}

/** Anchored links to each section (the page scrolls; nothing is hidden). */
export function SectionNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id)
  return (
    <nav aria-label="Vault sections" className="border-b">
      <ul className="-mb-px flex flex-wrap gap-x-4 gap-y-1">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              aria-current={active === s.id ? "location" : undefined}
              className={cn(
                "inline-block border-b-2 border-transparent py-2 text-sm text-muted-foreground hover:text-foreground",
                active === s.id && "border-foreground font-medium text-foreground",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
