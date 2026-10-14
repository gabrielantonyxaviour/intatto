"use client"

import Link from "next/link"
import { ArrowUpRightIcon } from "lucide-react"
import { useIntatto, type MarketState } from "@/lib/chain"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SESSION_LABEL, refusalsFor } from "./copy"
import { borrowHref, bpsShort } from "./format"

export function MarketHero({ state }: { state?: MarketState }) {
  const { mode } = useIntatto()
  const paused = state ? refusalsFor(state).length > 0 : false
  const session = state?.session === "UNKNOWN" ? "Session unknown" : state ? `US market · ${SESSION_LABEL[state.session]}` : "Reading US market session…"
  return (
    <header className="grid gap-5 pb-2 sm:gap-6">
      <div className="grid gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">Stock-backed lending on X Layer</p>
        <h1 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">Borrow against stocks, with limits that follow the market.</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Borrow USDG against tokenized stocks, with lower limits when US markets close.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Badge variant={paused ? "warning-light" : "outline"} className="h-auto max-w-full whitespace-normal px-3 py-1.5 text-xs leading-relaxed">
          {session}{state ? paused ? " · new borrowing paused" : ` · new loans up to ${bpsShort(state.maxLtvBps)}` : ""}
        </Badge>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button asChild className="h-10 px-4"><Link href={mode === "sandbox" ? borrowHref("NVDAx") : "/sandbox"}>
            {mode === "sandbox" ? "Borrow USDG" : "Try it in the sandbox"}<ArrowUpRightIcon aria-hidden />
          </Link></Button>
          {mode === "live" ? <Button asChild variant="ghost" className="h-10"><Link href="/borrow">Borrow</Link></Button> : null}
          <Button asChild variant="ghost" className="h-10"><Link href="/lend">Lend</Link></Button>
        </div>
      </div>
    </header>
  )
}
