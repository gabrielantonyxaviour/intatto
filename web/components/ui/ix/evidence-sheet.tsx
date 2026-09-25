"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { IxOverlayContext, useAssertRootOverlay } from "./overlay-context"

export type EvidenceState = "ready" | "fetching" | "empty" | "unavailable" | "partial"
export type EvidenceSheetProps = {
  title: string
  summary: string
  asOf?: string
  state: EvidenceState
  triggerLabel: string
  children?: ReactNode
  /** Controlled mode supports existing hashes/deep links. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  statusMessage?: string
  onRetry?: () => void
  testId?: string
  evidenceFor?: string
}
const messages = {
  fetching: "Fetching evidence…",
  empty: "No evidence records found for this scope.",
  unavailable: "Evidence is unavailable. This is not a successful or empty result.",
  partial: "Partial evidence only. The unscanned or unavailable scope is not verified.",
} as const

export function EvidenceSheet({ title, summary, asOf, state, triggerLabel, children, open, onOpenChange,
  statusMessage, onRetry, testId, evidenceFor }: EvidenceSheetProps) {
  useAssertRootOverlay()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild><Button type="button" variant="outline">{triggerLabel}</Button></SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl" data-testid={testId} data-evidence-for={evidenceFor}>
        <IxOverlayContext.Provider value={true}>
          <SheetHeader className="shrink-0 pr-12">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{summary}{asOf ? ` · ${asOf}` : ""}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto break-words px-4 pb-4" aria-busy={state === "fetching"}>
            {state !== "ready" && <div className="mb-4 grid gap-2" role={state === "unavailable" ? "alert" : "status"}>
              <p>{statusMessage ?? messages[state]}</p>
              {onRetry && state !== "fetching" && <Button type="button" variant="outline" onClick={onRetry}>Retry evidence</Button>}
            </div>}
            {(state === "ready" || state === "partial") && children}
          </div>
        </IxOverlayContext.Provider>
      </SheetContent>
    </Sheet>
  )
}
