"use client"

import type { ReactNode } from "react"
import type { MarketState, ProtocolParams, VaultState } from "@/lib/chain"
import { useIntatto, usePriceProvenance } from "@/lib/chain"
import { DefinitionPopover } from "@/components/ui/ix"
import { formatUtc } from "@/components/ui/web3/format"
import { pct, price, sessionMeaning } from "./format"
import { useNames } from "./names"

function age(fetchedAt: number, now: number) {
  const seconds = Math.max(0, now - fetchedAt)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  return `${Math.floor(seconds / 86400)} d ago`
}

function Term({ label, children, detail, source }: { label: string; children: ReactNode; detail: ReactNode; source?: string }) {
  return <div className="flex min-w-0 flex-wrap items-center gap-x-1">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular-nums">{children}</span>
    <DefinitionPopover term={label} source={source}>{detail}</DefinitionPopover>
  </div>
}

export function MarketStrip({ m, v, params }: { m: MarketState; v: VaultState; params?: ProtocolParams }) {
  const { token } = useNames()
  const { mode } = useIntatto()
  const provenance = usePriceProvenance()
  // A sandbox can travel in time. Compare its quote with the chain snapshot, not the wall clock.
  const now = mode === "sandbox" ? params?.blockTimestamp : Math.floor(Date.now() / 1000)
  const source = params ? `Parameters read at block ${params.blockNumber}` : undefined
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b pb-5 text-xs" aria-label="Market information">
    <Term label={`${token} price`} source={source} detail={<>
      <p data-testid="borrow-price-source">{provenance.short}</p>
      <p>{provenance.detail.replace("wNVDAx/USDG", `w${token}/USDG`)}</p>
    </>}><span data-testid="relayed-price">{price(m.priceE18)}</span></Term>
    <Term label="Fetched" detail={`Keeper quote fetched at ${formatUtc(m.fetchedAt)}. ${mode === "sandbox" ? "Age uses sandbox chain time; this is a simulation." : "The keeper relays the issuer quote; it is not a direct live exchange feed."}`}>
      <span title={formatUtc(m.fetchedAt)}>{now === undefined ? "age unavailable" : age(m.fetchedAt, Number(now))}</span>
    </Term>
    <Term label="Session" detail={sessionMeaning(m.session)}>{m.session}</Term>
    <Term label="Max LTV now" source={source} detail="The current limit for new borrowing. Available credit also depends on the stock's debt cap and vault liquidity.">
      <span data-testid="session-max-ltv">{pct(m.maxLtvBps)}</span>
    </Term>
    <Term label="Liquidation" detail="Above this LTV your collateral can be liquidated. This threshold stays the same when the market closes.">{pct(m.liquidationThresholdBps)}</Term>
    <Term label="Borrow APR" source={source} detail={`Variable with vault utilisation (now ${pct(v.utilizationBps)}). ${params ? `${pct(params.market.reserveFactorBps)} of interest funds the gap reserve.` : "Reserve allocation is loading or unavailable."}`}>
      <span data-testid="borrow-rate">{pct(v.borrowRateBps)}</span>
    </Term>
  </div>
}
