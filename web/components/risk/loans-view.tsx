"use client"

/**
 * Loans ranked by distance to liquidation (after a risk dashboard's realtime loans table): current LTV, the
 * session's new-borrow limit, the fixed liquidation LTV, distance, collateral, debt and liquidation price.
 */
import { useMemo, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AddressDisplay } from "@/components/ui/web3"
import { useRisk } from "./risk-data"
import { DataTable, type Column } from "./data-table"
import { Empty, LoadError, RowsSkeleton, Section } from "./states"
import { blockNo, pctBps, pctFraction, tokens18, usd18, usdg } from "./format"
import { distanceBps, dropToLiquidation, type Loan } from "./use-loans"

type Sort = "distance" | "debt" | "collateral"
const TOP = ["10", "30", "100", "all"] as const

function Filter({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span id={id} className="text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

export function LoansView() {
  const { loans, market, marketState, params, account, logs } = useRisk()
  const [sort, setSort] = useState<Sort>("distance")
  const [top, setTop] = useState<(typeof TOP)[number]>("30")
  const [hideRepaid, setHideRepaid] = useState(true)
  const lt = marketState.data?.liquidationThresholdBps ?? params.data?.market.liquidationThresholdBps ?? 6_500n
  const price = marketState.data?.priceE18 ?? 0n
  const me = account?.toLowerCase()

  const ranked = useMemo(() => {
    const list = (loans.data?.loans ?? []).filter((l) => !hideRepaid || l.debt > 0n)
    const cmp: Record<Sort, (a: Loan, b: Loan) => number> = {
      distance: (a, b) => (a.debt === 0n ? 1 : 0) - (b.debt === 0n ? 1 : 0) || Number(distanceBps(a, lt) - distanceBps(b, lt)),
      debt: (a, b) => (b.debt > a.debt ? 1 : b.debt < a.debt ? -1 : 0),
      collateral: (a, b) => (b.valueUsdg > a.valueUsdg ? 1 : b.valueUsdg < a.valueUsdg ? -1 : 0),
    }
    const sorted = [...list].sort(cmp[sort])
    return top === "all" ? sorted : sorted.slice(0, Number(top))
  }, [loans.data, hideRepaid, sort, top, lt])

  const columns: Column<Loan>[] = [
    {
      id: "borrower",
      header: "Borrower",
      cardTitle: true,
      cell: (l) => (
        <span className="inline-flex items-center gap-2">
          <AddressDisplay address={l.borrower} explorer />
          {me === l.borrower.toLowerCase() ? <Badge variant="info-light">You</Badge> : null}
          {l.liquidatable ? <Badge variant="destructive-light">Liquidatable</Badge> : null}
        </span>
      ),
    },
    {
      id: "ltv",
      header: "LTV · limit · liquidation",
      align: "right",
      cell: (l) => (
        <span className="grid">
          <span data-value="ltv">{l.debt === 0n ? "–" : pctBps(l.ltvBps)}</span>
          <span className="text-xs text-muted-foreground">
            {pctBps(l.maxLtvBps, 0)} · {pctBps(lt, 0)}
          </span>
        </span>
      ),
    },
    {
      id: "distance",
      header: "Distance to liquidation",
      align: "right",
      cell: (l) =>
        l.debt === 0n ? (
          "–"
        ) : (
          <span className="grid">
            <span data-value="distance" className={distanceBps(l, lt) <= 0n ? "text-destructive" : undefined}>
              {(Number(distanceBps(l, lt)) / 100).toFixed(2)} pts
            </span>
            <span className="text-xs text-muted-foreground">price −{pctFraction(dropToLiquidation(l, price))}</span>
          </span>
        ),
    },
    {
      id: "collateral",
      header: "Collateral",
      align: "right",
      cell: (l) => (
        <span className="grid">
          <span>{tokens18(l.assets, market.symbol)}</span>
          <span className="text-xs text-muted-foreground">{usdg(l.valueUsdg)}</span>
        </span>
      ),
    },
    { id: "debt", header: "Debt", align: "right", cell: (l) => <span data-value="debt">{usdg(l.debt)}</span> },
    { id: "net", header: "Net value", align: "right", cell: (l) => (l.valueUsdg >= l.debt ? usdg(l.valueUsdg - l.debt) : `−${usdg(l.debt - l.valueUsdg)}`) },
    { id: "liqPrice", header: `Liquidation price / ${market.symbol}`, align: "right", cell: (l) => (l.debt === 0n ? "–" : usd18(l.liquidationPriceE18)) },
  ]

  return (
    <Section
      id="loans"
      title="Loans near liquidation"
      description={
        <>
          Every borrower found in the scanned blocks, read now through the market lens
          {loans.data ? <> at block {blockNo(loans.data.block)}</> : null}. Distance is the LTV points left before {pctBps(lt, 0)}, and the price
          fall that would get there.
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <Filter id="loans-sort" label="Sort by">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger aria-labelledby="loans-sort" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="distance">Distance to liquidation</SelectItem>
              <SelectItem value="debt">Largest debt</SelectItem>
              <SelectItem value="collateral">Largest collateral</SelectItem>
            </SelectContent>
          </Select>
        </Filter>
        <Filter id="loans-top" label="Show">
          <Select value={top} onValueChange={(v) => setTop(v as (typeof TOP)[number])}>
            <SelectTrigger aria-labelledby="loans-top" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {TOP.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "all" ? "All" : `Top ${t}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filter>
        <div className="flex h-8 items-center gap-2">
          <Checkbox id="loans-hide-repaid" checked={hideRepaid} onCheckedChange={(c) => setHideRepaid(c === true)} />
          <Label htmlFor="loans-hide-repaid" className="text-sm font-normal">
            Hide loans with no debt
          </Label>
        </div>
      </div>
      {loans.isPending || logs.status === "pending" ? <RowsSkeleton rows={4} label="Loading loans" /> : null}
      {loans.isError ? <LoadError what="the loans" error={loans.error} onRetry={() => loans.refetch()} /> : null}
      {loans.data && ranked.length === 0 ? (
        <Empty>{loans.data.loans.length ? "Every borrower read has repaid in full." : logs.backfilling ? "No borrows in the blocks read so far; older blocks are still loading." : "No borrows since the deployment."}</Empty>
      ) : null}
      {ranked.length && loans.data ? (
        <div data-loans-block={loans.data.block.toString()} className="min-w-0">
          <DataTable
            label="Loans ranked by distance to liquidation"
            breakpoint="xl"
            rows={ranked}
            columns={columns}
            rowKey={(l) => l.borrower}
            rowClassName={(l) => (me === l.borrower.toLowerCase() ? "bg-muted/50" : undefined)}
            rowAttrs={(l) => ({ "data-row": "loan", "data-borrower": l.borrower.toLowerCase(), "data-ltv-bps": l.ltvBps.toString(), "data-debt": l.debt.toString() })}
          />
        </div>
      ) : null}
    </Section>
  )
}
