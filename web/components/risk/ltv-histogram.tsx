"use client"

/** Debt by current LTV in 5-point buckets, with the session limit and the liquidation LTV marked. */
import { pctBps, usdg } from "./format"
import type { Loan } from "./use-loans"

const BUCKET = 500n // 5 LTV points
const TOP = 10_000n // buckets run 0–100%; anything above lands in the last one

export function LtvHistogram({ loans, maxLtvBps, thresholdBps }: { loans: Loan[]; maxLtvBps: bigint; thresholdBps: bigint }) {
  const count = Number(TOP / BUCKET)
  const debt = Array.from({ length: count }, () => 0n)
  const n = Array.from({ length: count }, () => 0)
  for (const l of loans) {
    if (l.debt === 0n) continue
    const i = Math.min(count - 1, Number(l.ltvBps / BUCKET))
    debt[i] = debt[i]! + l.debt
    n[i] = n[i]! + 1
  }
  const max = debt.reduce((a, d) => (d > a ? d : a), 0n)
  const at = (bps: bigint) => `${Math.min(100, Number(bps) / 100)}%`

  return (
    <figure className="grid gap-2" aria-label="Debt by current LTV">
      <div className="relative h-40 border-b border-l">
        <div className="absolute inset-0 flex items-end gap-px px-px">
          {debt.map((d, i) => (
            <div
              key={i}
              className="min-w-0 flex-1 rounded-t-sm bg-primary"
              style={{ height: max === 0n ? 0 : `${Number((d * 1000n) / max) / 10}%` }}
              title={`${pctBps(BigInt(i) * BUCKET, 0)}–${pctBps(BigInt(i + 1) * BUCKET, 0)} LTV: ${usdg(d)} across ${n[i]} loan${n[i] === 1 ? "" : "s"}`}
              data-bucket={i}
            />
          ))}
        </div>
        <span aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: at(maxLtvBps) }} />
        <span aria-hidden className="absolute inset-y-0 w-0.5 bg-destructive" style={{ left: at(thresholdBps) }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 bg-foreground" />
          New-borrow limit now {pctBps(maxLtvBps, 0)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 bg-destructive" />
          Liquidation {pctBps(thresholdBps, 0)}
        </span>
        <span>Bar height: debt in each 5-point LTV bucket (tallest {usdg(max, 0)})</span>
      </figcaption>
    </figure>
  )
}
