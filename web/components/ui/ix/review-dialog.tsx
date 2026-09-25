"use client"

import type { ReactNode, RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { IxOverlayContext, useAssertRootOverlay } from "./overlay-context"

export type ReviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  amount: string
  asset: string
  chain: string
  triggerLabel?: string
  returnFocusRef?: RefObject<HTMLElement | null>
  beforeAfter?: ReactNode
  limit?: ReactNode
  /** Render existing ApproveThenAct/TxButton here, with transaction state owned by caller. */
  walletSteps?: ReactNode
  feeInfo?: ReactNode
  /** Required accessible name for the action area; the supplied control must also name its action. */
  actionLabel: string
  action: ReactNode
  receipt?: ReactNode
  children?: ReactNode
  testId?: string
}

/** Presentation only: never resets amounts, submits a transaction or clears a caller's receipt. */
export function ReviewDialog({ open, onOpenChange, title, amount, asset, chain, triggerLabel,
  beforeAfter, limit, walletSteps, feeInfo, actionLabel, action, receipt, children, testId, returnFocusRef }: ReviewDialogProps) {
  useAssertRootOverlay()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {triggerLabel && <DialogTrigger asChild><Button type="button">{triggerLabel}</Button></DialogTrigger>}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" data-testid={testId}
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef?.current) {
            event.preventDefault()
            returnFocusRef.current.focus()
          }
        }}>
        <IxOverlayContext.Provider value={true}>
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{amount} {asset} · {chain}</DialogDescription>
          </DialogHeader>
          {beforeAfter != null && <section aria-label="Before and after">{beforeAfter}</section>}
          {limit != null && <section aria-label="Transaction limits">{limit}</section>}
          {children}
          {walletSteps != null && <section aria-label="Wallet steps">{walletSteps}</section>}
          {feeInfo != null && <section aria-label="Fees">{feeInfo}</section>}
          <section aria-label={actionLabel}>{action}</section>
          {receipt != null && <section aria-label="Transaction receipt" aria-live="polite">{receipt}</section>}
          <DialogClose asChild><Button type="button" variant="outline">Back to form</Button></DialogClose>
        </IxOverlayContext.Provider>
      </DialogContent>
    </Dialog>
  )
}
