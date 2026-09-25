"use client"

import Link from "next/link"
import { useIntatto, type VaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AddressDisplay, ExplorerLink } from "@/components/ui/web3"
import { bpsText, lossExample, marketList, ratioText, usdg } from "./lend-format"
import { Section } from "./overview-section"
import { SummaryRow } from "./summary-row"
import type { LendMarket } from "./use-lend-reads"

/** The loss waterfall with live numbers, the gap reserve's funding rule and who controls what. */
export function RiskSection({ vault, markets }: { vault: VaultState; markets: LendMarket[] }) {
  const { deployment } = useIntatto()
  const market = markets[0]!.state
  const several = markets.length > 1
  const debt = markets.reduce((sum, m) => sum + m.state.totalDebt, 0n)
  const collateral = markets.reduce((sum, m) => sum + m.state.totalCollateralValue, 0n)
  const names = marketList(markets.map((m) => m.symbol))
  const steps = [
    {
      title: "Recovered collateral",
      value: usdg(collateral),
      testId: "waterfall-collateral",
      note: undefined,
      body: `An unhealthy position's ${several ? "collateral" : "NVDAx"} is sold into the pool in bounded slices. The proceeds repay its debt and the 5% penalty first. ${
        debt === 0n
          ? "No loans are open right now."
          : `Right now ${usdg(collateral, 0)} of collateral backs ${usdg(debt, 0)} of debt (${ratioText(
              debt,
              collateral,
              1,
            )} loan-to-value across all borrowers).`
      }`,
    },
    {
      title: "Gap reserve",
      value: usdg(vault.reserveBalance),
      testId: "waterfall-reserve",
      note: undefined,
      body: "If the collateral is gone and debt is left, the gap reserve pays the rest straight into the vault, up to its balance.",
    },
    {
      title: "Lenders, pro rata",
      value: usdg(vault.totalAssets),
      testId: "waterfall-lenders",
      body: "Whatever the reserve cannot pay is written off. Every share loses the same fraction.",
      note: lossExample(vault.totalAssets),
    },
  ]
  return (
    <Section id="risk" title="Risk">
      <Alert variant="warning" data-testid="loss-disclosure">
        <AlertTitle>Loss risk</AlertTitle>
        <AlertDescription>
          Lenders can lose money in a gap larger than the reserve. There is no insurance fund beyond the gap reserve. If{" "}
          {several ? names.replace(" and ", " or ") : "NVDAx"} opens far below where it closed and a liquidation
          cannot recover the debt, the gap reserve pays first; any remainder lowers the value of every lender&apos;s
          shares, in proportion to what they hold.
          {several && markets.some((m) => m.symbol === "SPYx") ? " SPYx is sandbox-only." : ""}
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
              <p className="text-sm text-muted-foreground">
                {s.body}
                {s.note ? (
                  <>
                    {" "}
                    <span data-testid="loss-example">{s.note}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Every open loan, ranked by how close it is to liquidation, and price-shock scenarios are on the{" "}
          <Link href="/risk" className="text-foreground underline underline-offset-4" data-testid="risk-page-link">
            Risk page
          </Link>
          .
        </p>
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
          <SummaryRow label="Liquidation threshold">
            {several
              ? `${markets.map((m) => `${m.symbol} ${bpsText(m.state.liquidationThresholdBps, 0)}`).join(" · ")} in every session`
              : `${bpsText(market.liquidationThresholdBps, 0)} in every session`}
          </SummaryRow>
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
            posts the market session, the {several ? "price of each market" : "NVDAx price"} and the debt cap, and runs liquidations; the contracts refuse a
            price outside their guards. Contracts: vault <AddressDisplay address={deployment.vault} />, gap reserve{" "}
            <AddressDisplay address={deployment.gapReserve} />.
          </p>
        </div>
      ) : null}
    </Section>
  )
}
