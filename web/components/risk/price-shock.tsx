"use client"

/**
 * Price shock: three scenarios over the loans read, each opened like an accordion (after a risk dashboard's
 * S1/S2/S3 list): a single drop, collateral at risk along the drop curve, and a gap deeper than the collateral.
 */
import { useState, type ReactNode } from "react"
import { ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRisk } from "./risk-data"
import { useDirectPlace } from "./status-bar"
import { Empty, LoadError, Panel, RowsSkeleton, Section } from "./states"
import { pctBps, usdg } from "./format"
import { liquidatableAfter, shockedValue, type Loan } from "./use-loans"

const SHOCKS = [0.05, 0.1, 0.2, 0.3, 0.5] as const
const CURVE = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const

function Scenario({ code, title, children, open }: { code: string; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-lg border bg-card" open={open} data-scenario={code}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-90" />
        {code}: {title}
      </summary>
      <div className="grid gap-3 border-t px-4 py-4">{children}</div>
    </details>
  )
}

function ShockPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Price drop">
      <span className="text-xs text-muted-foreground">Price drop</span>
      {SHOCKS.map((s) => (
        <Button key={s} size="sm" variant={value === s ? "default" : "outline"} aria-pressed={value === s} onClick={() => onChange(s)}>
          −{Math.round(s * 100)}%
        </Button>
      ))}
    </div>
  )
}

function atRisk(loans: Loan[], shock: number, lt: bigint) {
  const hit = loans.filter((l) => liquidatableAfter(l, shock, lt))
  const debt = hit.reduce((a, l) => a + l.debt, 0n)
  const value = hit.reduce((a, l) => a + shockedValue(l, shock), 0n)
  const shortfall = hit.reduce((a, l) => {
    const v = shockedValue(l, shock)
    return a + (l.debt > v ? l.debt - v : 0n)
  }, 0n)
  return { hit, debt, value, shortfall }
}

function Figures({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="grid min-w-0 gap-0.5">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="font-medium tabular-nums break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PriceShockView() {
  const { loans, market, marketState, vaultState, params } = useRisk()
  const place = useDirectPlace()
  const [s1, setS1] = useState<number>(0.2)
  const [s3, setS3] = useState<number>(0.5)
  const lt = marketState.data?.liquidationThresholdBps ?? params.data?.market.liquidationThresholdBps ?? 6_500n
  const penalty = params.data?.market.penaltyBps ?? 500n
  const reserve = vaultState.data?.reserveBalance
  const open = (loans.data?.loans ?? []).filter((l) => l.debt > 0n)

  return (
    <Section
      id="shock"
      title="Price shock"
      description={`What happens to the ${market.symbol} loans read if the relayed price falls. Estimates from each loan's collateral and debt, read directly from ${place}; the real liquidator sells in slices at a floor below the relayed price, so proceeds can be lower.`}
    >
      {loans.isPending ? <RowsSkeleton rows={3} label="Loading loans" /> : null}
      {loans.isError ? <LoadError what="the loans" error={loans.error} onRetry={() => loans.refetch()} /> : null}
      {loans.data && open.length === 0 ? <Empty>No open loans in the scanned blocks, so no shock reaches any position.</Empty> : null}
      {open.length ? (
        <div className="grid gap-3">
          <Scenario code="S1" title={`${market.symbol} falls by a set amount`} open>
            <ShockPicker value={s1} onChange={setS1} />
            {(() => {
              const r = atRisk(open, s1, lt)
              return (
                <>
                  <Figures
                    items={[
                      ["Loans past liquidation", `${r.hit.length} of ${open.length}`],
                      ["Their debt", usdg(r.debt)],
                      ["Their collateral after the drop", usdg(r.value)],
                      ["Penalty on that debt", usdg((r.debt * penalty) / 10_000n)],
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    A loan is liquidatable once its debt is above {pctBps(lt, 0)} of its collateral value. The penalty ({pctBps(penalty, 0)} of debt
                    repaid) is split between the keeper and the gap reserve.
                  </p>
                </>
              )
            })()}
          </Scenario>

          <Scenario code="S2" title="Collateral at risk along the drop">
            <ul className="grid gap-1.5 text-xs" aria-label="Collateral at risk by price drop">
              {(() => {
                const rows = CURVE.map((c) => ({ c, ...atRisk(open, c, lt) }))
                const max = rows.reduce((a, r) => (r.value > a ? r.value : a), 0n)
                return rows.map((r) => (
                  <li key={r.c} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2">
                    <span className="text-muted-foreground tabular-nums">−{Math.round(r.c * 100)}%</span>
                    <div className="h-3 min-w-0">
                      <div className="h-full rounded-sm bg-primary" style={{ width: `${max === 0n ? 0 : Number((r.value * 1000n) / max) / 10}%` }} />
                    </div>
                    <span className="tabular-nums">
                      {usdg(r.value, 0)} · {r.hit.length} loan{r.hit.length === 1 ? "" : "s"}
                    </span>
                  </li>
                ))
              })()}
            </ul>
            <p className="text-xs text-muted-foreground">Collateral value, after the drop, of the loans that would be liquidatable at that price.</p>
          </Scenario>

          <Scenario code="S3" title="A gap deeper than the collateral">
            <ShockPicker value={s3} onChange={setS3} />
            {(() => {
              const r = atRisk(open, s3, lt)
              const covered = reserve === undefined ? null : r.shortfall < reserve ? r.shortfall : reserve
              return (
                <Panel>
                  <Figures
                    items={[
                      ["Shortfall (debt above collateral)", usdg(r.shortfall)],
                      ["Gap reserve now", reserve === undefined ? "–" : usdg(reserve)],
                      ["Reserve would cover", covered === null ? "–" : usdg(covered)],
                      ["Lenders would lose", covered === null ? "–" : usdg(r.shortfall - covered)],
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    If a whole position sold at the dropped price, debt above the proceeds is paid by the gap reserve first; anything left is written
                    off as a lender deficit that lowers the vault&apos;s share price.
                  </p>
                </Panel>
              )
            })()}
          </Scenario>
        </div>
      ) : null}
    </Section>
  )
}
