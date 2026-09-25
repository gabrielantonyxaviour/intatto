"use client"

import type { ReactNode } from "react"
import type { Hex } from "viem"
import { CheckIcon } from "lucide-react"
import type { VaultState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ExplorerLink, RISK_LEVELS, riskLevel, ValueChange } from "@/components/ui/web3"
import { health, liqPrice, pct, usdg } from "./format"
import { bpsToFraction, type Metrics } from "./math"
import { useNames } from "./names"

const DOT = { Low: "bg-success", Medium: "bg-warning", High: "bg-destructive" } as const

function Cell({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums break-words" data-testid={testId}>
        {children}
      </span>
    </div>
  )
}

/** The position as it will be once every step below has gone through (Liquity's preview card, neutral). */
export function PreviewCard({ caption, before, after, v }: { caption: string; before: Metrics; after: Metrics; v: VaultState }) {
  const names = useNames()
  const level = after.debt > 0n ? riskLevel(bpsToFraction(after.ltvBps), RISK_LEVELS) : null
  return (
    <Card data-testid="review-preview">
      <CardContent className="grid gap-4">
        <div className="grid gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{caption}</span>
          <span className="text-2xl font-medium tabular-nums">{usdg(after.debt)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <ValueChange className="col-span-2 flex-wrap [&>span:last-child]:flex-wrap" label="Collateral" before={before.assets} after={after.assets} format={(value) => names.tokens(BigInt(value))} />
          <ValueChange className="col-span-2 flex-wrap [&>span:last-child]:flex-wrap" label="Debt" before={before.debt} after={after.debt} format={(value) => usdg(BigInt(value))} />
          <ValueChange className="col-span-2 flex-wrap" label="Liquidation price" before={before.liquidationPriceE18} after={after.liquidationPriceE18} format={(value) => liqPrice(BigInt(value))} />
          <ValueChange className="col-span-2 flex-wrap" label="LTV" before={before.ltvBps} after={after.ltvBps} format={(value) => pct(BigInt(value))} />
          <Cell label="Interest rate">{pct(v.borrowRateBps)} variable</Cell>
          <Cell label="Liquidation risk">
            {level ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2 rounded-full", DOT[level])} />
                {level}
              </span>
            ) : (
              "None"
            )}
          </Cell>
          <ValueChange className="col-span-2 flex-wrap" label="Health factor" before={before.healthE18} after={after.healthE18} format={(value) => health(BigInt(value))} />
        </div>
      </CardContent>
    </Card>
  )
}

export function ReceiptRow({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5 border-b py-3 last:border-b-0">
      <span className="text-sm">{label}</span>
      <span className="ml-auto grid justify-items-end text-right">
        <span className="text-sm font-medium tabular-nums">{value}</span>
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
      </span>
    </div>
  )
}

export type DoneStep = { title: string; hash: Hex }

/** A confirmed step, with its transaction (OKLink on mainnet, the hash as text in the sandbox). */
export function DoneRow({ step }: { step: DoneStep }) {
  return (
    <li className="flex items-start gap-3" data-testid="review-done-step">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-success bg-success text-white">
        <CheckIcon aria-hidden className="size-3.5" />
      </span>
      <span className="grid min-w-0 gap-0.5 pt-0.5">
        <span className="text-sm">{step.title}</span>
        <span className="text-xs text-muted-foreground">
          Confirmed · <ExplorerLink hash={step.hash} />
        </span>
      </span>
    </li>
  )
}

export function UpcomingRow({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground tabular-nums">
        {n}
      </span>
      <span className="grid min-w-0 gap-0.5 pt-0.5">
        <span className="text-sm text-muted-foreground">{title}</span>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </span>
    </li>
  )
}

export function FinishedNote({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  return (
    <div className="grid gap-3" data-testid="review-finished">
      <p className="text-sm">{children}</p>
      <Button type="button" variant="outline" onClick={onDone}>
        Back to the form
      </Button>
    </div>
  )
}
