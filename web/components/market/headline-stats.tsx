"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import type { MarketState, VaultState } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { bps, usdg } from "./format"

function Stat({ id, label, value, sub, hint }: { id: string; label: string; value: ReactNode; sub?: ReactNode; hint: string }) {
  const text = typeof value === "string" ? value : ""
  const splitAt = text.lastIndexOf(" ")
  const number = splitAt > 0 ? text.slice(0, splitAt) : text
  const unit = splitAt > 0 ? text.slice(splitAt + 1) : ""
  return (
    <div data-testid={`stat-${id}`} className="grid min-w-0 content-start gap-1">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="shrink-0">
          <DefinitionPopover term={label}>{hint}</DefinitionPopover>
        </span>
      </dt>
      <dd data-slot="value" className="min-w-0 text-base leading-tight font-semibold tabular-nums sm:text-lg lg:text-xl">
        {typeof value === "string" ? (
          <>
            <span className="block">{number}</span>
            {unit ? <span className="block text-xs font-medium text-muted-foreground"> {unit}</span> : null}
          </>
        ) : (
          value
        )}
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
    <div data-testid="headline-stats" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
        <Stat id="deposits" label="Total deposits" value={usdg(vault.totalAssets)} hint="USDG lenders have in the vault, including what is lent out." />
        <Stat id="loans" label="Loans" value={usdg(loans)} hint="USDG borrowers owe across every market, with interest to date." />
        <Stat id="available" label="Available" value={usdg(vault.idle)} hint="Idle USDG in the vault: what can be borrowed or withdrawn now." />
        <Stat id="utilisation" label="Utilisation" value={bps(vault.utilizationBps)} hint="Share of deposits currently lent out." />
      </dl>
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-4 border-t pt-3 lg:grid-cols-3">
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
        <Stat id="collateral" label="Collateral value" value={usdg(collateral)} hint="Tokenized stock held as collateral, valued at the relayed price." />
      </dl>
      <p data-testid="waterfall-line" className="text-sm text-muted-foreground sm:col-span-2">
        If a liquidation cannot repay a loan, the gap reserve pays the rest; anything beyond it becomes a recognised deficit
        that lenders share pro rata.{" "}
        <Link href="/lend#risk" className="font-medium text-foreground underline underline-offset-4">
          How losses are covered
        </Link>
      </p>
    </div>
  )
}
