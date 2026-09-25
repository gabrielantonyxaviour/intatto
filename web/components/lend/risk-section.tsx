"use client"

import { useIntatto, type MarketState, type VaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AddressDisplay, ExplorerLink } from "@/components/ui/web3"
import { bpsText, ratioText, usdg } from "./lend-format"
import { Section } from "./overview-section"
import { SummaryRow } from "./summary-row"

/** Share price drop, in percent, for each 1,000 USDG written off against the vault's assets. */
function dropPer1000(totalAssets: bigint): string {
  if (totalAssets === 0n) return "–"
  return `${((1_000_000_000 / Number(totalAssets)) * 100).toFixed(3)}%`
}

/** The loss waterfall with live numbers, the gap reserve's funding rule and who controls what. */
export function RiskSection({ vault, market }: { vault: VaultState; market: MarketState }) {
  const { deployment } = useIntatto()
  const steps = [
    {
      title: "Recovered collateral",
      value: usdg(market.totalCollateralValue),
      testId: "waterfall-collateral",
      body: `An unhealthy position's NVDAx is sold into the pool in bounded slices. The proceeds repay its debt and the 5% penalty first. ${
        market.totalDebt === 0n
          ? "No loans are open right now."
          : `Right now ${usdg(market.totalCollateralValue, 0)} of collateral backs ${usdg(market.totalDebt, 0)} of debt (${ratioText(
              market.totalDebt,
              market.totalCollateralValue,
              1,
            )} loan-to-value across all borrowers).`
      }`,
    },
    {
      title: "Gap reserve",
      value: usdg(vault.reserveBalance),
      testId: "waterfall-reserve",
      body: "If the collateral is gone and debt is left, the gap reserve pays the rest straight into the vault, up to its balance.",
    },
    {
      title: "Lenders, pro rata",
      value: usdg(vault.totalAssets),
      testId: "waterfall-lenders",
      body: `Whatever the reserve cannot pay is written off. Every share loses the same fraction: each 1,000 USDG written off lowers the share price by ${dropPer1000(
        vault.totalAssets,
      )} at today's deposits.`,
    },
  ]
  return (
    <Section id="risk" title="Risk">
      <Alert variant="warning" data-testid="loss-disclosure">
        <AlertTitle>Loss risk</AlertTitle>
        <AlertDescription>
          Lenders can lose money in a gap larger than the reserve. There is no insurance fund beyond the gap reserve. If NVDAx opens far below where it closed and a liquidation
          cannot recover the debt, the gap reserve pays first; any remainder lowers the value of every lender&apos;s
          shares, in proportion to what they hold.
        </AlertDescription>
      </Alert>

      <div className="grid gap-2">
        <h3 className="font-medium">Who pays for a loss, in order</h3>
        <ol className="grid gap-3 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="grid content-start gap-2 rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {i + 1}. {s.title}
                </span>
              </div>
              <p data-testid={s.testId} className="text-lg font-medium tabular-nums">
                {s.value}
              </p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-2">
        <h3 className="font-medium">How the gap reserve is funded</h3>
        <dl className="grid gap-2">
          <SummaryRow label="Balance now" testId="reserve-balance">
            {usdg(vault.reserveBalance)}
          </SummaryRow>
          <SummaryRow label="Seed">USDG sent by the operator at launch (anyone can add more)</SummaryRow>
          <SummaryRow label="Interest">20% of all interest borrowers pay</SummaryRow>
          <SummaryRow label="Liquidations">Half of each 5% penalty (the keeper who liquidates keeps the other half)</SummaryRow>
          <SummaryRow label="Withdrawals">None: it can only pay shortfalls to the vault</SummaryRow>
        </dl>
      </div>

      <div className="grid gap-2">
        <h3 className="font-medium">Market risk parameters</h3>
        <dl className="grid gap-2">
          <SummaryRow label="Liquidation threshold">{bpsText(market.liquidationThresholdBps, 0)} in every session</SummaryRow>
          <SummaryRow label="New-borrow limit">
            50% open · 40% extended · 30% falling to 20% over 64 h closed · 0% halted
          </SummaryRow>
          <SummaryRow label="Liquidation penalty">5%, half to the keeper, half to the gap reserve</SummaryRow>
          <SummaryRow label="Reserve factor">20% of interest</SummaryRow>
        </dl>
      </div>

      {deployment ? (
        <div className="grid gap-2">
          <h3 className="font-medium">Roles</h3>
          <dl className="grid gap-x-8 gap-y-2 md:grid-cols-2">
            <SummaryRow label="Operator (owner)">
              <ExplorerLink address={deployment.operator} />
            </SummaryRow>
            <SummaryRow label="Keeper">
              <ExplorerLink address={deployment.keeper} />
            </SummaryRow>
          </dl>
          <p className="text-sm text-muted-foreground">
            The operator can change the interest-rate model, the session limits, the price guards and the liquidation
            floors, and add markets to the vault, with no timelock. The keeper
            posts the market session, the NVDAx price and the debt cap, and runs liquidations; the contracts refuse a
            price outside their guards. Contracts: vault <AddressDisplay address={deployment.vault} />, gap reserve{" "}
            <AddressDisplay address={deployment.gapReserve} />.
          </p>
        </div>
      ) : null}
    </Section>
  )
}
