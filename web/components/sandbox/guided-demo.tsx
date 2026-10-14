"use client"

import Link from "next/link"
import { CheckIcon, ArrowUpRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ActionButton, type Admin } from "./admin-controls"
import { SCENARIOS, WARPS } from "./copy"
import type { useDemoProgress } from "./demo-progress"

export type DemoProgress = ReturnType<typeof useDemoProgress>
const STEPS = [
  { title: "Borrow against NVDAx", description: "Open Borrow and use your funded test wallet to try a loan." },
  { title: "Close the market", description: "Move to Saturday to see the lower weekend borrowing limit." },
  { title: "Try to borrow more", description: "Above the weekend limit, the contract refuses: SessionLimit." },
  { title: "Replay a real gap", description: "January 2025 CFD prices on this fork. Then inspect the outcome in Risk." },
  { title: "Stress the reserve", description: "A synthetic 45% drop. The reserve pays first; lenders can lose money." },
]

export function DemoStep({ step, admin, progress, compact = false, onNavigate }: {
  step: number; admin: Admin; progress: DemoProgress; compact?: boolean; onNavigate?: () => void
}) {
  const data = STEPS[step - 1]!
  const done = progress.done.includes(step)
  const primary = step === progress.next && !progress.complete
  const control = step === 2 ? WARPS[0]! : step === 4 ? SCENARIOS[0]! : SCENARIOS[3]!
  return (
    <div className={`flex min-w-0 gap-3 ${compact ? "" : "py-5"}`} aria-current={primary ? "step" : undefined}>
      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${primary ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
        {done ? <CheckIcon className="size-4" aria-label="Done" /> : step}
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <h3 className="text-sm font-semibold">{data.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.description}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-3 pt-1">
          {step === 1 || step === 3 ? (
            <Button asChild variant={primary ? "default" : "outline"} size="sm">
              <Link href="/borrow" onClick={() => { progress.visit(step); onNavigate?.() }}>Open Borrow <ArrowUpRightIcon aria-hidden /></Link>
            </Button>
          ) : (
            <ActionButton admin={admin} request={step === 2 ? { kind: "warp", target: "saturday" } : { kind: "scenario", name: step === 4 ? "gap-2025-01" : "synthetic-gap" }}
              label={control.label} busy={control.busy} variant={primary ? "default" : "outline"} />
          )}
          {step >= 4 && done ? <Link href={step === 4 ? "/risk" : "/lend"} onClick={onNavigate} className="text-sm font-medium underline underline-offset-4">{step === 4 ? "Open Risk" : "Open Lend"}</Link> : null}
          {done && (step === 1 || step === 3) ? <span className="text-xs text-muted-foreground">Borrow opened</span> : null}
        </div>
      </div>
    </div>
  )
}

export function GuidedDemo({ admin, progress }: { admin: Admin; progress: DemoProgress }) {
  return (
    <Card className="gap-0" data-testid="guided-demo">
      <CardHeader className="gap-3 border-b pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Guided demo</h2>
          <span className="text-xs text-muted-foreground tabular-nums" role="status">{progress.complete ? "5 of 5 steps explored" : `Step ${progress.next} of 5`}</span>
        </div>
        <p className="text-sm text-muted-foreground">Follow a loan through a market close and a price gap.</p>
        <div className="flex gap-1" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1 flex-1 rounded-full ${progress.done.includes(n) ? "bg-foreground" : "bg-muted"}`} />)}</div>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">{STEPS.map((s, i) => <li key={s.title}><DemoStep step={i + 1} admin={admin} progress={progress} /></li>)}</ol>
      </CardContent>
    </Card>
  )
}
