"use client"

import { useAccount } from "wagmi"
import { useIntatto } from "@/lib/chain"
import { CopyButton } from "./copy-button"
import { creditQuery, curlFor, DEMO_WALLET, PUBLIC_ORIGIN } from "./content"

export function ApiExample() {
  const { address } = useAccount()
  const { mode, sandbox } = useIntatto()
  const example = curlFor(`${PUBLIC_ORIGIN}${creditQuery({
    wallet: address ?? DEMO_WALLET,
    market: "NVDAx",
    network: mode === "sandbox" ? "sandbox" : "mainnet",
    session: mode === "sandbox" ? sandbox?.sessionId : undefined,
  })}`)
  return (
    <div className="grid min-w-0 gap-3 rounded-xl bg-muted/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">GET /api/credit</span>
        <CopyButton value={example} label="Copy curl example" />
      </div>
      <pre className="min-w-0 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{example}</pre>
      <p className="text-xs text-muted-foreground">
        {address ? "Uses your connected wallet" : "Uses the demo wallet"} · {mode === "sandbox" ? "Sandbox simulation" : "X Layer mainnet"}
      </p>
    </div>
  )
}
