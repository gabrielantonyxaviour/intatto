import type { MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { health, pct, price } from "./format"
import { gapRows, type GapRow, type Metrics } from "./math"

function Status({ row }: { row: GapRow }) {
  return row.liquidatable ? (
    <Badge variant="destructive-light">Liquidatable</Badge>
  ) : (
    <Badge variant="success-light">Safe</Badge>
  )
}

/** What a Monday open lower than Friday's close would do to the position (the product's reason to exist). */
export function GapTable({ position, m }: { position: Metrics; m: MarketState }) {
  const rows = gapRows(position, m.priceE18, m.liquidationThresholdBps)
  if (position.debt === 0n) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="gap-table-empty">
        With no debt, no gap can liquidate you.
      </p>
    )
  }
  return (
    <div data-testid="gap-table" className="grid gap-2">
      <ul className="grid gap-2 sm:hidden">
        {rows.map((r) => (
          <li key={r.dropPct} className={cn("grid gap-2 rounded-lg border p-3 text-sm", r.liquidatable && "border-destructive/40")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Opens −{r.dropPct}%</span>
              <Status row={r} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">NVDAx</dt>
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
            </dl>
          </li>
        ))}
      </ul>
      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow>
            <TableHead>Monday open</TableHead>
            <TableHead className="text-right">NVDAx</TableHead>
            <TableHead className="text-right">LTV</TableHead>
            <TableHead className="text-right">Health</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.dropPct}>
              <TableCell>−{r.dropPct}%</TableCell>
              <TableCell className="text-right tabular-nums">{price(r.priceE18)}</TableCell>
              <TableCell className={cn("text-right tabular-nums", r.liquidatable && "text-destructive")}>{pct(r.ltvBps)}</TableCell>
              <TableCell className="text-right tabular-nums">{health(r.healthE18)}</TableCell>
              <TableCell className="text-right">
                <Status row={r} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Liquidation starts above {pct(m.liquidationThresholdBps)} LTV (health below 1.00) in every session, with a 5% penalty.
      </p>
    </div>
  )
}
