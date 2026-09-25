"use client"

import Link from "next/link"
import { CircleCheckIcon, CircleXIcon } from "lucide-react"
import type { MarketState } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { DefinitionPopover } from "@/components/ui/ix"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { guardResults, type MarketTerms } from "./copy"
import type { RelayDetail } from "./use-market-params"

type Props = {
  symbol: string
  state: MarketState
  relay: RelayDetail | undefined
  relayFailed: boolean
  now: number
  terms: MarketTerms | undefined
}

/** Pass or fail stays on the row. The reading behind a passing check opens from its button. */
export function GuardList({ symbol, state, relay, relayFailed, now, terms }: Props) {
  const guards = guardResults(state, relay, now, symbol, relayFailed, terms?.twapWindowSeconds)
  const failing = guards.filter((g) => !g.ok).length
  return (
    <Card data-testid="guards">
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          Guards
          <DefinitionPopover term="Guards" contentTestId="guards-meaning">
            Fresh is the keeper post against the relay&apos;s liveness limit. In band is the implied wrapper price against the session&apos;s
            pool TWAP band. Peg is Chainlink USDG/USD against the relay&apos;s peg band. A failing row is the current outcome, not a definition.
          </DefinitionPopover>
        </CardTitle>
        <CardDescription>
          {failing === 0 ? "Every check a new borrow needs passes right now." : `${failing} of ${guards.length} checks fail, so new borrowing is refused.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {guards.map((g) => (
            <li key={g.key} data-testid={`guard-${g.key}`} data-ok={g.ok ? "true" : "false"} className="flex gap-2.5 text-sm">
              {g.ok ? (
                <CircleCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <CircleXIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div className="grid min-w-0 gap-0.5">
                <span className={cn("font-medium", !g.ok && "text-destructive")}>
                  {g.label} <span className="sr-only">{g.ok ? "passes" : "fails"}</span>
                  <span aria-hidden className="font-normal text-muted-foreground">
                    {" "}
                    {g.ok ? "✓" : "✗"}
                  </span>
                </span>
                {g.ok ? (
                  <DefinitionPopover term={g.label} contentTestId={`guard-${g.key}-meaning`}>
                    {g.reason}
                  </DefinitionPopover>
                ) : (
                  <span className="break-words text-muted-foreground">{g.reason}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Each check&apos;s history, the keeper&apos;s log and the caps are on{" "}
          <Link href="/risk" data-testid="guards-risk-link" className="font-medium text-foreground underline underline-offset-4">
            the Risk page
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
