"use client"

import Link from "next/link"
import { CircleAlertIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"

export function RefusalCard({ reason, code, simulated }: { reason: string; code?: string; simulated?: boolean }) {
  const { mode } = useIntatto()
  return <div role="status" className="flex gap-3 rounded-lg bg-muted/65 p-4 text-sm" data-testid="loan-refused-now">
    <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
    <div className="grid min-w-0 gap-1.5">
      <p className="font-medium">{code ? `Refused: ${code}` : "This action is unavailable"}</p>
      <p className="text-muted-foreground">{reason}</p>
      <p className="text-xs text-muted-foreground">Repaying and adding collateral still work.</p>
      {mode === "live" ? <Link href="/sandbox" className="text-xs font-medium underline underline-offset-4">Start a mainnet-fork sandbox session</Link> : null}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Details</summary>
        <p className="pt-1">{simulated ? "The contract refused this in a simulation." : "Checked against the market's current limits."} Nothing was signed or sent.{mode === "live" ? " The sandbox uses a funded test wallet; no mainnet funds move." : ""}</p>
      </details>
    </div>
  </div>
}
