"use client"

import Link from "next/link"
import { ChevronDownIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** Environment switch; the old badge test IDs remain on its responsive labels. */
export function ChainBadge() {
  const { hydrated, mode, sandbox, endSandbox } = useIntatto()
  if (!hydrated) return <Skeleton className="h-8 w-20 shrink-0" aria-hidden />
  const isSandbox = mode === "sandbox" && Boolean(sandbox)
  const item = "rounded-md px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  return (
    <div data-testid="chain-badge" data-mode={mode} className="shrink-0">
      <div data-testid="chain-badge-short" className="lg:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 gap-1 px-2 text-xs" aria-label="Choose environment">
              {isSandbox ? "Sandbox" : "Mainnet"}<ChevronDownIcon className="size-3" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <p className="text-xs text-muted-foreground">Environment</p>
            <Button variant={isSandbox ? "ghost" : "secondary"} onClick={endSandbox} aria-pressed={!isSandbox}>Mainnet</Button>
            <Button variant={isSandbox ? "secondary" : "ghost"} asChild><Link href="/sandbox" aria-current={isSandbox ? "true" : undefined}>Sandbox</Link></Button>
            <p className="text-xs text-muted-foreground">{isSandbox ? "Switching to Mainnet exits this simulation." : "Try a simulation with a funded test wallet."}</p>
          </PopoverContent>
        </Popover>
      </div>
      <div data-testid="chain-badge-long" role="group" aria-label="Environment" className="hidden items-center rounded-lg bg-muted p-1 lg:flex">
        <button type="button" onClick={endSandbox} aria-pressed={!isSandbox} className={cn(item, !isSandbox ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>Mainnet</button>
        <Link href="/sandbox" aria-current={isSandbox ? "true" : undefined} className={cn(item, isSandbox ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>Sandbox</Link>
      </div>
    </div>
  )
}
