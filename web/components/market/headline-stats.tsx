"use client"

import Link from "next/link"
import type { MarketState, VaultState } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { bpsShort, dollars, usdgExact } from "./format"

function Stat({ id, label, value, hint, exact }: { id: string; label: string; value: string; hint: string; exact?: string }) {
  return (
    <div data-testid={`stat-${id}`} className="grid min-w-0 content-start gap-2 rounded-xl border p-4 sm:p-5">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}<DefinitionPopover term={label}>{hint}</DefinitionPopover>
      </dt>
      <dd data-slot="value" title={exact} className="text-2xl leading-tight font-semibold tracking-tight tabular-nums lg:text-3xl">{value}</dd>
    </div>
  )
}

export function HeadlineStats({ vault, markets }: { vault: VaultState; markets: MarketState[] }) {
  const loans = markets.reduce((sum, m) => sum + m.totalDebt, 0n)
  const collateral = markets.reduce((sum, m) => sum + m.totalCollateralValue, 0n)
  return (
    <section data-testid="headline-stats" aria-label="Market totals" className="grid gap-3">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat id="deposits" label="Total deposits" value={dollars(vault.totalAssets)} exact={usdgExact(vault.totalAssets)} hint="USDG lenders have in the vault, including what is lent out." />
        <Stat id="loans" label="Borrowed" value={dollars(loans)} exact={usdgExact(loans)} hint="USDG owed across every market, including accrued interest." />
        <Stat id="utilisation" label="Utilisation" value={bpsShort(vault.utilizationBps)} hint="Share of deposits currently lent out." />
        <Stat id="reserve" label="Gap reserve" value={dollars(vault.reserveBalance)} exact={usdgExact(vault.reserveBalance)} hint="USDG that covers liquidation shortfalls before losses reach lenders." />
      </dl>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span data-testid="stat-available">Available <span data-slot="value" className="tabular-nums">{dollars(vault.idle)}</span></span>
        <span data-testid="stat-collateral">Collateral value <span data-slot="value" className="tabular-nums">{dollars(collateral)}</span></span>
        <span data-testid="stat-deficits">Recognised deficits <span data-slot="value" className="tabular-nums">{dollars(vault.totalDeficit)}</span> <span data-testid="deficit-count">({vault.deficitCount.toString()} recorded)</span></span>
      </div>
      <p data-testid="waterfall-line" className="text-xs leading-relaxed text-muted-foreground">Lenders can lose money if a shortfall exceeds the gap reserve. <Link href="/lend#risk" className="underline underline-offset-4">How losses are covered</Link></p>
    </section>
  )
}
