"use client"

import type { ReactNode } from "react"
import { InfoIcon } from "lucide-react"
import type { MarketState, VaultState } from "@/lib/chain"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { bps, usdg } from "./format"

function Stat({ id, label, value, hint }: { id: string; label: string; value: ReactNode; hint: string }) {
  return (
    <div data-testid={`stat-${id}`} className="grid min-w-0 gap-1">
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
    </div>
  )
}

/** Five headline numbers across the top: deposits, loans, available, collateral value, utilisation. */
export function HeadlineStats({ vault, markets }: { vault: VaultState; markets: MarketState[] }) {
  const loans = markets.reduce((sum, m) => sum + m.totalDebt, 0n)
  const collateral = markets.reduce((sum, m) => sum + m.totalCollateralValue, 0n)
  return (
    <dl data-testid="headline-stats" className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
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
    </dl>
  )
}
