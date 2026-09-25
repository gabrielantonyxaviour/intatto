"use client"

import Link from "next/link"
import type { MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { health, pct, price, usdg } from "./format"
import { gapRows, type GapRow, type Metrics } from "./math"
import { useNames } from "./names"

const drop = (r: GapRow) => `−${(Number(r.dropBps) / 100).toFixed(r.dropBps % 100n === 0n ? 0 : 2)}%`

function Status({ row }: { row: GapRow }) {
  if (row.line) return <Badge variant="warning-light">Liquidation starts</Badge>
  return row.liquidatable ? <Badge variant="destructive-light">Liquidatable</Badge> : <Badge variant="success-light">Safe</Badge>
}

/** Lender loss, with the reserve's share shown when a shortfall exists but is (partly) covered. */
function Loss({ row }: { row: GapRow }) {
  return (
    <span className="grid justify-items-end">
      <span className={cn("tabular-nums", row.lenderLoss > 0n && "text-destructive")}>{usdg(row.lenderLoss)}</span>
      {row.shortfall > 0n ? (
        <span className="text-[11px] text-muted-foreground">
          reserve covers {usdg(row.shortfall - row.lenderLoss)}
        </span>
      ) : null}
    </span>
  )
}

/** What a Monday open lower than Friday's close would do to the position, down to where lenders start to lose. */
export function GapTable({ position, m, reserveUsdg, penaltyBps }: { position: Metrics; m: MarketState; reserveUsdg: bigint; penaltyBps?: bigint }) {
  const { token } = useNames()
  if (position.debt === 0n) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="gap-table-empty">
        With no debt, no gap can liquidate you.
      </p>
    )
  }
  if (penaltyBps === undefined) return <p role="status" className="text-sm text-muted-foreground">Gap estimates unavailable until the liquidation penalty is read from the chain.</p>
  const rows = gapRows(position, m.priceE18, m.liquidationThresholdBps, reserveUsdg, penaltyBps)
  return (
    <div data-testid="gap-table" className="grid gap-2">
      <ul className="grid gap-2 sm:hidden">
        {rows.map((r) => (
          <li
            key={r.dropBps.toString()}
            data-testid={r.line ? "gap-line" : undefined}
            className={cn("grid gap-2 rounded-lg border p-3 text-sm", r.liquidatable && "border-destructive/40", r.line && "border-warning")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Opens {drop(r)}</span>
              <Status row={r} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs min-[440px]:grid-cols-4">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">{token}</dt>
                <dd className="tabular-nums">{price(r.priceE18)}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">LTV</dt>
                <dd className={cn("tabular-nums", r.liquidatable && "text-destructive")}>{pct(r.ltvBps)}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">Health</dt>
                <dd className="tabular-nums">{health(r.healthE18)}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">Lenders lose</dt>
                <dd className={cn("tabular-nums", r.lenderLoss > 0n && "text-destructive")}>{usdg(r.lenderLoss)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow>
            <TableHead>Monday open</TableHead>
            <TableHead className="text-right">{token}</TableHead>
            <TableHead className="text-right">LTV</TableHead>
            <TableHead className="text-right">Health</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead className="text-right">Lenders lose (est.)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.dropBps.toString()} data-testid={r.line ? "gap-line" : undefined} className={cn(r.line && "bg-warning/10")}>
              <TableCell className="tabular-nums">{drop(r)}</TableCell>
              <TableCell className="text-right tabular-nums">{price(r.priceE18)}</TableCell>
              <TableCell className={cn("text-right tabular-nums", r.liquidatable && "text-destructive")}>{pct(r.ltvBps)}</TableCell>
              <TableCell className="text-right tabular-nums">{health(r.healthE18)}</TableCell>
              <TableCell className="text-right">
                <Status row={r} />
              </TableCell>
              <TableCell className="text-right">
                <Loss row={r} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground" data-testid="gap-note">
        Liquidation starts above {pct(m.liquidationThresholdBps)} LTV (health below 1.00) in every session, with a {pct(penaltyBps)} penalty.
        What-if price drops are assumptions, not a forecast or historical replay. Lender loss is an estimate at the oracle price with no slippage: the debt that selling all the collateral would not
        repay after the penalty, less the gap reserve&apos;s {usdg(reserveUsdg)} (shared by every position).{" "}
        <Link href="/risk" className="underline underline-offset-4 hover:text-foreground">
          Market-wide stress on the Risk page
        </Link>
        .
      </p>
    </div>
  )
}
