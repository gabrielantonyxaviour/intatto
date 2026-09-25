"use client"

import { useId, useState, type ReactNode } from "react"
import { useIntatto } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { marketList } from "./lend-format"

const FLOW = [
  { label: "You", note: "the lender" },
  { label: "Deposit USDG", note: "you receive iUSDG vault shares" },
  { label: "Intatto USDG vault", note: "holds idle USDG and what is lent out" },
  { label: "NVDAx market", note: "borrowers post NVDAx and borrow USDG" },
] as const

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Deposit USDG in the vault",
    body: "You receive iUSDG shares. A share is worth more USDG as borrowers pay interest, and less if a loss is ever written off.",
  },
  {
    title: "The vault lends to one market: NVDAx",
    body: "Borrowers post NVDAx (held as the issuer's wNVDAx wrapper shares) and borrow USDG up to a limit that follows the US market session. As a depositor you carry this market's risks: the stock itself, the keeper-relayed price and the 65% liquidation threshold.",
  },
  {
    title: "Earn interest from over-collateralised borrowers",
    body: "Lenders receive 80% of the interest borrowers pay. The other 20% funds the gap reserve, which pays for a liquidation shortfall before lenders do.",
  },
]

/** First-visit primer (lender → vault → market) with the terms checkbox that gates the first deposit. */
export function PrimerDialog({
  open,
  onOpenChange,
  accepted,
  onAccept,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accepted: boolean
  onAccept: () => void
}) {
  const [ticked, setTicked] = useState(false)
  const checkId = useId()
  const { deployment } = useIntatto()
  const symbols = deployment?.markets.map((m) => m.symbol) ?? ["NVDAx"]
  const several = symbols.length > 1
  const names = marketList(symbols)
  const flow = several
    ? [
        FLOW[0],
        FLOW[1],
        FLOW[2],
        { label: names, note: "borrowers post collateral and borrow USDG" },
      ]
    : FLOW
  const steps = several
    ? STEPS.map((step, i) =>
        i === 1
          ? {
              title: `The vault lends into ${names}`,
              body: `Borrowers post ${names.replace(" and ", " or ")} (held as the issuer's wrapper shares) and borrow USDG up to a limit that follows the US market session. ${
                symbols.includes("SPYx") ? "SPYx is sandbox-only. " : ""
              }As a depositor you carry each market's risks: the stock itself, the keeper-relayed price and the liquidation threshold.`,
            }
          : step,
      )
    : STEPS
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="lend-primer"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>How lending on Intatto works</DialogTitle>
          <DialogDescription>Read this once before your first deposit.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <ol aria-label="Where your USDG goes" className="grid content-start gap-0">
            {flow.map((node, i) => (
              <li key={node.label} className="grid gap-0">
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-sm font-medium">{node.label}</p>
                  <p className="text-xs text-muted-foreground">{node.note}</p>
                </div>
                {i < flow.length - 1 ? <span aria-hidden className="ml-5 h-4 border-l border-dashed" /> : null}
              </li>
            ))}
          </ol>
          <div className="grid gap-4">
            <ol className="grid gap-4">
              {steps.map((step, i) => (
                <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2">
                  <span className="text-sm text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <div className="grid gap-1">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="grid gap-2 border-t pt-4 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Lenders can lose money.</span> If a stock gaps further than
                the collateral and the gap reserve can cover, the rest is written off and every lender&apos;s shares lose
                value pro rata. There is no insurance fund beyond the gap reserve.
              </p>
              <p>
                The NVDAx price is the issuer&apos;s indicative quote, relayed on chain by a keeper. It carries no source
                timestamp; the relay only accepts it inside a band around the pool&apos;s 30-minute average.
              </p>
              <p>Intatto is experimental software. Check that you may use it where you live.</p>
            </div>
            {accepted ? (
              <p className="text-sm text-muted-foreground">You accepted these terms on this device.</p>
            ) : (
              <div className="grid gap-3">
                <div className="flex items-start gap-3">
                  <Checkbox id={checkId} checked={ticked} onCheckedChange={(v) => setTicked(v === true)} className="mt-0.5" />
                  <label htmlFor={checkId} className="text-sm leading-snug">
                    I have read how lending works and understand I can lose part of my deposit.
                  </label>
                </div>
                <Button className="justify-self-end" disabled={!ticked} onClick={onAccept}>
                  Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
