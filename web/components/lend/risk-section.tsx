"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useIntatto, usePriceProvenance, useProtocolParams, type VaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { EvidenceSheet, type EvidenceState } from "@/components/ui/ix"
import { AddressDisplay, ExplorerLink } from "@/components/ui/web3"
import { bpsText, lossExample, marketList, ratioText, usdg } from "./lend-format"
import { Section } from "./overview-section"
import { SummaryRow } from "./summary-row"
import { useRoleAddresses, type LendMarket } from "./use-lend-reads"

/** Loss warning and reserve balance stay inline. The waterfall, funding and roles open in one sheet. */
export function RiskSection({ vault, markets }: { vault: VaultState; markets: LendMarket[] }) {
  const { deployment } = useIntatto()
  const provenance = usePriceProvenance()
  const params = useProtocolParams("NVDAx")
  const spy = useProtocolParams("SPYx")
  const roles = useRoleAddresses()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#risk") setOpen(true)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  const several = markets.length > 1
  const names = marketList(markets.map((m) => m.symbol))
  const debt = markets.reduce((sum, m) => sum + m.state.totalDebt, 0n)
  const collateral = markets.reduce((sum, m) => sum + m.state.totalCollateralValue, 0n)
  const penalty = params.data ? bpsText(params.data.market.penaltyBps, 0) : null
  const reserveShare = params.data ? bpsText(params.data.market.reserveFactorBps, 0) : null
  const hours = params.data ? Math.round(Number(params.data.session.closedDecayDuration) / 3600) : null
  const failed = params.status === "error" || params.status === "unavailable" || roles.isError
  const state: EvidenceState = failed ? "partial" : "ready"
  const thresholds = markets
    .map((m) => `${m.symbol} ${bpsText(m.state.liquidationThresholdBps, 0)}`)
    .join(" · ")
  const steps = [
    {
      title: "Recovered collateral",
      value: usdg(collateral),
      testId: "waterfall-collateral",
      body: `An unhealthy position's ${several ? "collateral" : names} is sold into the pool in bounded slices. The proceeds repay its debt${
        penalty ? ` and the ${penalty} penalty` : ""
      } first. ${
        debt === 0n
          ? "No loans are open right now."
          : `Right now ${usdg(collateral, 0)} of collateral backs ${usdg(debt, 0)} of debt (${ratioText(debt, collateral, 1)} loan-to-value across all borrowers).`
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
          {several ? names.replace(" and ", " or ") : names} opens far below where it closed and a liquidation cannot
          recover the debt, the gap reserve pays first; any remainder lowers the value of every lender&apos;s shares, in
          proportion to what they hold.
          {several && markets.some((m) => m.symbol === "SPYx") ? " SPYx is sandbox-only." : ""}
        </AlertDescription>
      </Alert>
      <SummaryRow label="Gap reserve" testId="reserve-balance">
        {usdg(vault.reserveBalance)}
      </SummaryRow>
      <EvidenceSheet
        title="Risk and reserve"
        triggerLabel="Risk and reserve"
        summary="CollateralMarket, SessionRiskController, LendingVault.owner and PriceRelayAdapter.keeper"
        asOf={params.data ? `Block ${params.data.blockNumber}` : undefined}
        state={state}
        open={open}
        onOpenChange={setOpen}
        testId="lend-risk-sheet"
        evidenceFor="risk"
        statusMessage="A parameter or role read failed. No stand-in percentage or deployment-file address is shown."
        onRetry={() => {
          void qc.invalidateQueries({ queryKey: ["protocol-params"] })
          void roles.refetch()
        }}
      >
        <div className="grid gap-2">
          <h3 className="font-medium">Who pays for a loss, in order</h3>
          <ol className="grid gap-3">
            {steps.map((s, i) => (
              <li key={s.title} className="grid content-start gap-2 rounded-lg border p-3">
                <span className="text-sm font-medium">
                  {i + 1}. {s.title}
                </span>
                <p data-testid={s.testId} className="text-lg font-medium tabular-nums">
                  {s.value}
                </p>
                <p className="text-sm text-muted-foreground">
                  {s.body}
                  {s.note ? <span data-testid="loss-example"> {s.note}</span> : null}
                </p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Every open loan, ranked by how close it is to liquidation, is on the{" "}
            <Link href="/risk" className="text-foreground underline underline-offset-4" data-testid="risk-page-link">
              Risk page
            </Link>
            .
          </p>
        </div>
        <div className="mt-4 grid gap-2">
          <h3 className="font-medium">How the gap reserve is funded</h3>
          <dl className="grid gap-2">
            <SummaryRow label="Seed">USDG sent by the operator at launch (anyone can add more)</SummaryRow>
            <SummaryRow label="Interest">
              {reserveShare ? `${reserveShare} of all interest borrowers pay` : "Reading the reserve factor from the market."}
            </SummaryRow>
            <SummaryRow label="Liquidations">
              {penalty ? `Half of each ${penalty} penalty (the keeper who liquidates keeps the other half)` : "Reading the penalty from the market."}
            </SummaryRow>
            <SummaryRow label="Withdrawals">None: it can only pay shortfalls to the vault</SummaryRow>
          </dl>
        </div>
        <div className="mt-4 grid gap-2">
          <h3 className="font-medium">Market risk parameters</h3>
          <dl className="grid gap-2">
            <SummaryRow label="Liquidation threshold">{thresholds} in every session</SummaryRow>
            <SummaryRow label="New-borrow limit">
              {params.data
                ? `${bpsText(params.data.session.openBps, 0)} open · ${bpsText(params.data.session.extendedBps, 0)} extended · ${bpsText(params.data.session.closedStartBps, 0)} falling to ${bpsText(params.data.session.closedFloorBps, 0)} over ${hours} h closed · 0% halted`
                : "Reading session limits from the contract."}
            </SummaryRow>
            <SummaryRow label="Liquidation penalty">
              {penalty ? `${penalty}, half to the keeper, half to the gap reserve` : "Reading the penalty from the market."}
            </SummaryRow>
            <SummaryRow label="Reserve factor">
              {reserveShare
                ? several && spy.data
                  ? `NVDAx ${reserveShare} · SPYx ${bpsText(spy.data.market.reserveFactorBps, 0)} of interest`
                  : `${reserveShare} of interest`
                : "Reading the reserve factor from the market."}
            </SummaryRow>
          </dl>
        </div>
        {deployment ? (
          <div className="mt-4 grid gap-2">
            <h3 className="font-medium">Roles</h3>
            <dl className="grid gap-2">
              <SummaryRow label="Operator (owner)">
                {roles.data ? <ExplorerLink address={roles.data.owner} /> : roles.isError ? "Could not read owner()" : "Reading owner()"}
              </SummaryRow>
              <SummaryRow label="Keeper">
                {roles.data ? <ExplorerLink address={roles.data.keeper} /> : roles.isError ? "Could not read keeper()" : "Reading keeper()"}
              </SummaryRow>
            </dl>
            <p className="text-sm text-muted-foreground">
              The operator can change the interest-rate model, the session limits, the price guards and the liquidation
              floors, and add markets to the vault, with no timelock. The keeper posts the market session, {provenance.short}, and
              the debt cap, and runs liquidations. {provenance.detail} Contracts: vault <AddressDisplay address={deployment.vault} />, gap
              reserve <AddressDisplay address={deployment.gapReserve} />.
            </p>
          </div>
        ) : null}
      </EvidenceSheet>
    </Section>
  )
}
