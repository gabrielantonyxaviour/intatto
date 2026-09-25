"use client"

import { useIntatto, useMarketDeployment } from "@/lib/chain"
import { CopyButton, EvidenceSheet } from "@/components/ui/ix"
import { useNames } from "./names"

export function ContractsSheet() {
  const { symbol } = useNames()
  const { deployment, chain, mode } = useIntatto()
  const market = useMarketDeployment(symbol)
  const rows = market && deployment ? [
    ["Collateral market", market.market], [symbol, market.token], [`w${symbol}`, market.wrapper],
    ["USDG", deployment.usdg], ["Lending vault", deployment.vault], ["Price relay", market.priceRelay],
    ["Corporate action guard", market.corporateActionGuard], ["Pool", market.pool],
    ["Session risk", deployment.sessionRisk], ["Depth caps", deployment.depthCaps],
    ["Gap reserve", deployment.gapReserve], ["Liquidator", deployment.liquidator], ["Market lens", deployment.lens],
  ] : []
  return (
    <EvidenceSheet title={`${symbol} contracts`} triggerLabel="Contracts" state={rows.length ? "ready" : "unavailable"}
      summary={`Active deployment configuration · ${chain.name} · ${mode}`}
      asOf={deployment ? `Deployment block ${deployment.block} (not a current state block)` : undefined}>
      <dl className="grid gap-4">
        {rows.map(([label, address]) => <div key={label} className="grid gap-1">
          <dt className="font-medium">{label}</dt>
          <dd className="grid justify-items-start gap-2"><code className="min-w-0 break-all text-xs">{address}</code>
            <CopyButton name={`${label} address`} value={address} />
          </dd>
        </div>)}
      </dl>
    </EvidenceSheet>
  )
}
