"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { InfoIcon } from "lucide-react"
import type { MarketState, VaultState } from "@/lib/chain"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { bps, usdg } from "./format"

function Stat({ id, label, value, sub, hint }: { id: string; label: string; value: ReactNode; sub?: ReactNode; hint: string }) {
  return (
    <div data-testid={`stat-${id}`} className="grid min-w-0 content-start gap-1">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        <Tooltip>
          <TooltipTrigger className="rounded-sm text-muted-foreground" aria-label={`About ${label.toLowerCase()}`}>
            <InfoIcon aria-hidden className="size-3" />
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      </dt>
      <dd data-slot="value" className="text-lg font-semibold tabular-nums break-words sm:text-xl">
        {value}
      </dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  )
}

/**
 * Headline numbers: deposits, loans, available, collateral value, utilisation, then what covers a loss (the gap
 * reserve) and what was not covered (recognised deficits), with the waterfall in one line.
 */
export function HeadlineStats({ vault, markets }: { vault: VaultState; markets: MarketState[] }) {
  const loans = markets.reduce((sum, m) => sum + m.totalDebt, 0n)
  const collateral = markets.reduce((sum, m) => sum + m.totalCollateralValue, 0n)
  return (
    <div data-testid="headline-stats" className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
      <dl className="contents">
        <Stat id="deposits" label="Total deposits" value={usdg(vault.totalAssets)} hint="USDG lenders have in the vault, including what is lent out." />
        <Stat id="loans" label="Loans" value={usdg(loans)} hint="USDG borrowers owe across every market, with interest to date." />
        <Stat id="available" label="Available" value={usdg(vault.idle)} hint="Idle USDG in the vault: what can be borrowed or withdrawn now." />
        <Stat
          id="collateral"
          label="Collateral value"
          value={usdg(collateral)}
          hint="Tokenized stock held as collateral, valued at the relayed price."
        />
        <Stat id="utilisation" label="Utilisation" value={bps(vault.utilizationBps)} hint="Share of deposits currently lent out." />
        <Stat
          id="reserve"
          label="Gap reserve"
          value={usdg(vault.reserveBalance)}
          hint="USDG set aside to pay debt a liquidation could not recover, before lenders lose anything."
        />
        <Stat
          id="deficits"
          label="Recognised deficits"
          value={usdg(vault.totalDeficit)}
          sub={
            <span data-testid="deficit-count">
              {vault.deficitCount === 1n ? "1 recorded" : `${vault.deficitCount.toString()} recorded`}
            </span>
          }
          hint="Debt neither the collateral nor the gap reserve could repay, written off against lenders."
        />
      </dl>
      <p data-testid="waterfall-line" className="col-span-2 self-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
        If a liquidation cannot repay a loan, the gap reserve pays the rest; anything beyond it becomes a recognised deficit
        that lenders share pro rata.{" "}
        <Link href="/lend#risk" className="font-medium text-foreground underline underline-offset-4">
          How losses are covered
        </Link>
      </p>
    </div>
  )
}
