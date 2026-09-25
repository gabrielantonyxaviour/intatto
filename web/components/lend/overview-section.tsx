"use client"

import type { ReactNode } from "react"
import { useAccount } from "wagmi"
import { useIntatto, type AccountState, type VaultState } from "@/lib/chain"
import { Skeleton } from "@/components/ui/skeleton"
import { ExplorerLink, TokenAmount } from "@/components/ui/web3"
import { SHARE_SYMBOL, USDG_DECIMALS, ratioText, sharePriceText, usdg } from "./lend-format"
import { SummaryRow } from "./summary-row"

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 grid-cols-1 gap-4">
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Vault configuration: contract, share token, share price and who can do what. */
export function OverviewSection({ vault }: { vault: VaultState }) {
  const { deployment } = useIntatto()
  if (!deployment) return null
  return (
    <Section id="overview" title="Overview">
      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <SummaryRow label="Vault contract" className="border-b pb-3">
          <ExplorerLink address={deployment.vault} />
        </SummaryRow>
        <SummaryRow label="Share price" className="border-b pb-3" testId="share-price">
          {sharePriceText(vault.sharePrice)}
        </SummaryRow>
        <SummaryRow label="Share token" className="border-b pb-3">
          {SHARE_SYMBOL} (ERC-4626, 6 decimals)
        </SummaryRow>
        <SummaryRow label="Shares outstanding" className="border-b pb-3">
          <TokenAmount value={vault.totalSupply} decimals={USDG_DECIMALS} maxFractionDigits={2} symbol={SHARE_SYMBOL} />
        </SummaryRow>
        <SummaryRow label="Withdrawals" className="border-b pb-3">
          Any time, up to the idle USDG
        </SummaryRow>
        <SummaryRow label="Markets" className="border-b pb-3">
          1 (NVDAx)
        </SummaryRow>
      </dl>
    </Section>
  )
}

/** The connected wallet's shares and what they are worth now. */
export function PositionSection({
  vault,
  account,
  loading,
}: {
  vault: VaultState
  account: AccountState | undefined
  loading: boolean
}) {
  const { isConnected } = useAccount()
  return (
    <Section id="position" title="Your position">
      {!isConnected ? (
        <p className="text-sm text-muted-foreground">Connect a wallet to see your deposit.</p>
      ) : loading || !account ? (
        <div className="grid gap-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ) : (
        <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          <SummaryRow label="Your shares" className="border-b pb-3" testId="position-shares">
            <TokenAmount value={account.vaultShares} decimals={USDG_DECIMALS} maxFractionDigits={6} symbol={SHARE_SYMBOL} />
          </SummaryRow>
          <SummaryRow label="Worth now" className="border-b pb-3" testId="position-value">
            {usdg(account.vaultAssets, 6)}
          </SummaryRow>
          <SummaryRow label="Share of the vault" className="border-b pb-3">
            {ratioText(account.vaultShares, vault.totalSupply, 4)}
          </SummaryRow>
          <SummaryRow label="USDG in your wallet" className="border-b pb-3" testId="position-wallet">
            {usdg(account.walletUsdg)}
          </SummaryRow>
        </dl>
      )}
    </Section>
  )
}
