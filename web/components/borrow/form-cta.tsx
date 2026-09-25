"use client"

import type { ReactNode } from "react"
import { useAccount, useSwitchChain } from "wagmi"
import { Loader2Icon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import type { DecodedTxError } from "@/components/ui/web3"
import type { Preflight } from "./preflight"
import type { Refusal } from "./plan"

export type Cta = {
  label: string
  enabled: boolean
  spinning?: boolean
  onClick?: () => void
  note?: ReactNode
}

/** The form's one button. Its label is always the reason it cannot go further (Morpho/Aave pattern). */
export function FormCta({ cta, onReview }: { cta: Cta; onReview: () => void }) {
  const { chain } = useIntatto()
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  let label = cta.label
  let onClick: (() => void) | undefined = cta.enabled ? (cta.onClick ?? onReview) : undefined
  let spinning = cta.spinning
  let note = cta.note
  if (!isConnected) {
    label = "Connect a wallet"
    onClick = undefined
    note = <p className="text-xs text-muted-foreground">Use the wallet button at the top of the page.</p>
  } else if (chainId !== chain.id) {
    label = isPending ? "Switching…" : `Switch to ${chain.name}`
    onClick = isPending ? undefined : () => switchChain({ chainId: chain.id })
    spinning = isPending
    note = null
  }

  return (
    <div data-slot="form-cta" className="grid gap-2">
      <Button type="button" size="lg" className="w-full" disabled={!onClick} aria-busy={spinning || undefined} onClick={onClick}>
        {spinning ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {label}
      </Button>
      {note}
    </div>
  )
}

export function RefusalNote({ reason, simulated }: { reason: string; simulated: boolean }) {
  return (
    <div role="status" className="grid gap-0.5 text-xs">
      <p className="text-destructive">{reason}</p>
      <p className="text-muted-foreground">
        {simulated
          ? "The contract refused this in a simulation. Nothing was signed or sent."
          : "Checked against the market's current limits. Nothing was signed or sent."}
      </p>
    </div>
  )
}

function FailedNote({ error }: { error: DecodedTxError }) {
  return (
    <div role="status" className="grid gap-1 text-xs">
      <p className="text-destructive">Could not check this with the contract: {error.message}</p>
      <details className="text-muted-foreground">
        <summary className="cursor-pointer select-none">More details</summary>
        <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px] break-all whitespace-pre-wrap">
          {error.details}
        </pre>
      </details>
    </div>
  )
}

/**
 * Label for an action the contract can check on its own (no approval pending): the simulation's verdict first,
 * then the client pre-check while the simulation is still running.
 */
export function simulatedCta(preflight: Preflight, precheck: Refusal | null): Cta | null {
  if (preflight.status === "refused") {
    const name = preflight.error.errorName ?? "reverted"
    return { label: `Refused: ${name}`, enabled: false, note: <RefusalNote reason={preflight.error.message} simulated /> }
  }
  if (precheck) return { label: precheck.label, enabled: false, note: <RefusalNote reason={precheck.reason} simulated={false} /> }
  if (preflight.status === "checking") return { label: "Checking with the contract…", enabled: false, spinning: true }
  if (preflight.status === "failed") {
    return { label: "Retry check", enabled: true, onClick: preflight.retry, note: <FailedNote error={preflight.error} /> }
  }
  return null
}

/** Same for an action that follows another step (e.g. borrow after a deposit): only the client pre-check applies. */
export function precheckCta(precheck: Refusal | null): Cta | null {
  return precheck ? { label: precheck.label, enabled: false, note: <RefusalNote reason={precheck.reason} simulated={false} /> } : null
}
