"use client"

import { useIntatto, type VaultState } from "@/lib/chain"
import { Badge } from "@/components/ui/badge"
import { ExplorerLink } from "@/components/ui/web3"
import { bpsText, marketList, dollars } from "./lend-format"

function Stat({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd data-testid={testId} className="text-2xl font-semibold lg:text-3xl tabular-nums break-words">
        {value}
      </dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  )
}

/** Vault name, identity chips, four headline numbers. */
export function VaultHero({ vault }: { vault: VaultState }) {
  const { deployment, chain, mode } = useIntatto()
  const symbols = deployment?.markets.map((m) => m.symbol) ?? []
  const names = marketList(symbols)
  return (
    <section aria-labelledby="lend-title" className="grid gap-5">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 id="lend-title" className="text-3xl font-semibold tracking-tight">
            USDG vault
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
          <span data-testid="lend-markets">Exposure: {names}</span>
        </div>
        <p className="max-w-2xl text-muted-foreground" data-testid="lend-intro">
          Earn variable interest from stock-backed loans on X Layer.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Stat label="Supply APR" value={bpsText(vault.supplyRateBps)} sub="Variable annual rate" testId="stat-supply-rate" />
        <Stat label="Total deposits" value={dollars(vault.totalAssets)} testId="stat-total-deposits" />
        <Stat label="Available to withdraw" value={dollars(vault.idle)} sub="Idle USDG in the vault" testId="stat-idle" />
        <Stat label="Utilisation" value={bpsText(vault.utilizationBps)} sub="Share of deposits lent out" />
      </dl>
    </section>
  )
}
