"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FlaskConicalIcon } from "lucide-react"
import { useIntatto, useMarketState } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ActionOutcome, TimeTravel } from "./admin-controls"
import { useDemoProgress } from "./demo-progress"
import { DemoStep } from "./guided-demo"
import { Scenarios } from "./scenarios"
import { SessionBadge } from "./session-status"
import { useAdminAction, useApiBase, useLedger } from "./use-sandbox"

function ActiveDock({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const { base } = useApiBase()
  const admin = useAdminAction(base, sessionId)
  const ledger = useLedger(base, sessionId)
  const progress = useDemoProgress(sessionId, admin, ledger.data)
  const market = useMarketState("NVDAx")
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" aria-label={`Sandbox controls, step ${progress.next} of 5`} className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 size-11 rounded-full border-foreground/20 bg-background shadow-md sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:h-10 sm:w-auto sm:rounded-lg sm:px-4" data-testid="sandbox-dock">
          <FlaskConicalIcon aria-hidden /><span className="hidden sm:inline">Sandbox controls <span className="ml-1 text-xs text-muted-foreground">{progress.complete ? "Done" : `${progress.next}/5`}</span></span>
          <span aria-hidden className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background sm:hidden">{progress.next}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-md" data-testid="sandbox-dock-panel">
        <SheetHeader className="pr-12">
          <SheetTitle>Sandbox controls</SheetTitle>
          <SheetDescription>Simulation only. No real money moves.</SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 gap-6 overflow-y-auto px-4 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{progress.complete ? "All steps explored" : `Step ${progress.next} of 5`}</span>{market.data ? <SessionBadge session={market.data.session} /> : null}</div>
          {base ? <>
            {progress.complete ? <p className="text-sm">Explore the results in Risk and Lend, or return to Sandbox to reset.</p> : <DemoStep step={progress.next} admin={admin} progress={progress} compact onNavigate={() => setOpen(false)} />}
            <ActionOutcome admin={admin} />
            <div className="border-t pt-4"><TimeTravel admin={admin} /></div>
            <Scenarios admin={admin} compact />
          </> : <p className="text-sm text-muted-foreground">This custom fork has no sandbox API for time travel or scenarios.</p>}
          <Link href="/sandbox" onClick={() => setOpen(false)} className="text-sm font-medium underline underline-offset-4">Open Sandbox · all controls & session</Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Mounted once by the app shell; the Sandbox page already has the full controls. */
export function SandboxDock() {
  const { mode, sandbox } = useIntatto()
  const pathname = usePathname()
  if (mode !== "sandbox" || !sandbox || pathname === "/sandbox") return null
  return <ActiveDock key={sandbox.sessionId} sessionId={sandbox.sessionId} />
}
