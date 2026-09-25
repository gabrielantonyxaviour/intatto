"use client"

/**
 * Trust and bounds: what the keeper is trusted with, what the contracts stop it doing, every bound read onchain
 * with a worked example of a liquidation, and the status of the Chainlink v10 adapter.
 */
import { Badge } from "@/components/ui/badge"
import { AddressDisplay } from "@/components/ui/web3"
import { useRisk } from "./risk-data"
import { LoadError, Panel, Section } from "./states"
import { duration, pctBps, usdg } from "./format"

const or = (v: bigint | undefined, f: (x: bigint) => string) => (v === undefined ? "–" : f(v))

export function TrustView() {
  const { params, deployment, market } = useRisk()
  const p = params.data
  const r = p?.relay
  const s = p?.session
  const l = p?.liquidator
  const lt = p?.market.liquidationThresholdBps ?? 6_500n
  const penalty = p?.market.penaltyBps ?? 500n

  const sheet: [string, string, string][] = [
    ["Price freshness", or(r?.priceLiveness, duration), "A price older than this is stale: new borrowing and liquidation stop until the keeper posts again."],
    ["Fetch age at post", or(r?.maxFetchAge, duration), "The keeper must post within this long of fetching the quote."],
    ["TWAP band", r?.bandOpenBps !== undefined && r.bandOtherBps !== undefined ? `±${pctBps(r.bandOpenBps, 0)} open · ±${pctBps(r.bandOtherBps, 0)} otherwise` : "–", "A post outside the band around the pool's 30-minute TWAP is rejected."],
    ["Max move per post", or(r?.maxMoveBps, (x) => pctBps(x, 0)), "A bigger jump from the last accepted price is rejected; the keeper has to step towards it."],
    ["USDG/USD peg", r?.pegBps !== undefined && r.usdgMaxAge !== undefined ? `within ${pctBps(r.pegBps, 0)}, fresh within ${duration(r.usdgMaxAge)}` : "–", "Checked against Chainlink USDG/USD on every post."],
    ["Session liveness", or(s?.livenessLimit, duration), "Without a session post for this long the market reads UNKNOWN and lends nothing new."],
    ["New-borrow LTV", s?.openBps !== undefined ? `${pctBps(s.openBps, 0)} / ${or(s.extendedBps, (x) => pctBps(x, 0))} / ${or(s.closedStartBps, (x) => pctBps(x, 0))}→${or(s.closedFloorBps, (x) => pctBps(x, 0))}` : "–", "OPEN / EXTENDED / CLOSED start → floor. HALTED, CORPORATE_ACTION and UNKNOWN allow 0%."],
    ["Liquidation LTV", pctBps(lt, 0), "Fixed in the market contract, the same in every session."],
    ["Liquidation penalty", pctBps(penalty, 0), "Of the debt repaid; half to whoever ran the slice, half to the gap reserve."],
    ["Liquidation floor", l?.openFloorBps !== undefined && l.closedFloorBps !== undefined ? `${pctBps(l.openFloorBps, 0)} open · ${pctBps(l.closedFloorBps, 0)} closed` : "–", `A slice never sells below the relayed price minus this. While CLOSED a waiting slice widens to ${or(l?.closedTimeoutFloorBps, (x) => pctBps(x, 0))} after ${or(l?.closedTimeout, duration)}.`],
    ["Cap ramp", p?.caps.stepBps !== undefined && p.caps.minStepUsdg !== undefined ? `${pctBps(p.caps.stepBps, 0)} or ${usdg(p.caps.minStepUsdg, 0)} per hour` : "–", "How fast a higher cap target takes effect. Lower targets apply at once."],
    ["Corporate action pause", or(p?.guard.window, duration), "Borrowing and liquidation pause this long before a multiplier change activates."],
    ["Reserve factor", or(p?.market.reserveFactorBps, (x) => pctBps(x, 0)), "Share of borrower interest kept for the protocol instead of lenders."],
  ]

  return (
    <Section id="trust" title="Trust and bounds" description="What you are trusting when you use Intatto, and where the contracts stop that trust.">
      {params.isError && !p ? <LoadError what="the contract parameters" error={params.error} onRetry={() => params.refetch()} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="The keeper is a trusted relayer">
          <p className="text-sm text-muted-foreground">
            The {market.symbol} price is the issuer&apos;s indicative quote, relayed by Intatto&apos;s keeper
            {p?.keeper ? (
              <>
                {" "}
                (<AddressDisplay address={p.keeper} copy={false} explorer />)
              </>
            ) : null}
            . The quote carries no source timestamp, so the console shows when the keeper fetched it, never how fresh the stock price is.
          </p>
          <div className="grid gap-1 text-sm">
            <span className="font-medium">It can</span>
            <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
              <li>post the market session, the price, the credit cap target and upcoming corporate actions; a wrong session post can open borrowing up to the OPEN limit, never beyond it</li>
              <li>run liquidation slices (anyone can; the keeper usually does)</li>
              <li>stop posting, which turns borrowing off once its posts go stale</li>
            </ul>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-medium">The contracts stop it from</span>
            <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
              <li>moving anyone&apos;s collateral, deposits or the reserve</li>
              <li>posting a price outside the TWAP band, beyond the max move, or while USDG is off peg</li>
              <li>lending past the OPEN session&apos;s limit, or raising the cap faster than its ramp</li>
              <li>selling collateral below the liquidation floor</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            The operator
            {p?.owner ? (
              <>
                {" "}
                (<AddressDisplay address={p.owner} copy={false} explorer />)
              </>
            ) : null}{" "}
            can change these bounds and the keeper address; every change emits an event.
          </p>
        </Panel>
        <Panel title="Chainlink Data Streams adapter">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning-light">Not live</Badge>
            <Badge variant="outline">Built and unit-tested</Badge>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="chainlink-status">
            A v10 report verifier for Chainlink Data Streams is built and unit-tested, but not wired live: Intatto has no Data Streams
            entitlement on X Layer yet, so the keeper relay above is the only price source.
          </p>
          {deployment.chainlinkV10Adapter ? (
            <p className="text-sm">
              Deployed, unused: <AddressDisplay address={deployment.chainlinkV10Adapter} explorer />
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel title="Bounds read onchain" description="Each mechanism and the number the contract enforces now.">
        <dl className="grid gap-3 md:grid-cols-2">
          {sheet.map(([k, v, why]) => (
            <div key={k} className="grid min-w-0 gap-0.5 rounded-lg border p-3" data-param={k}>
              <dt className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">{k}</span>
                <span className="tabular-nums">{v}</span>
              </dt>
              <dd className="text-xs text-muted-foreground">{why}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="A liquidation, worked through">
        <p className="text-sm text-muted-foreground">
          Say a loan has {usdg(1_000_000_000n, 0)} of {market.symbol} collateral and {usdg(700_000_000n, 0)} of debt: 70% LTV, past the{" "}
          {pctBps(lt, 0)} line. The liquidator seizes enough wrapper shares to cover the debt plus the {pctBps(penalty, 0)} penalty and sells
          them into the pool, never below the floor. Proceeds repay the {usdg(700_000_000n, 0)}; the penalty ({usdg((700_000_000n * penalty) / 10_000n, 0)})
          goes half to the caller and half to the gap reserve; anything left returns to the borrower. If the collateral runs out first, the gap
          reserve pays the rest and only then do lenders share a deficit.
        </p>
      </Panel>
    </Section>
  )
}
