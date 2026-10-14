"use client"

import { useQuery } from "@tanstack/react-query"
import { FlaskConicalIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatUtc } from "@/components/ui/web3/format"

function ChainTime() {
  const { publicClient, chainId } = useIntatto()
  const block = useQuery({
    queryKey: ["intatto:latest-block", chainId],
    queryFn: () => publicClient.getBlock({ blockTag: "latest" }),
    refetchInterval: 5_000,
    retry: 1,
  })
  if (block.data) {
    return <time dateTime={new Date(Number(block.data.timestamp) * 1000).toISOString()} title={formatUtc(block.data.timestamp)}>{new Date(Number(block.data.timestamp) * 1000).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</time>
  }
  if (block.isError) return <span className="text-muted-foreground" title="Fork RPC not reachable">Time unavailable</span>
  return <span className="text-muted-foreground">loading…</span>
}

/** Shown on every screen while the app runs against a sandbox fork instead of X Layer mainnet. */
export function SandboxBanner() {
  const { hydrated, mode, sandbox, sandboxError, endSandbox } = useIntatto()
  if (hydrated && sandboxError) {
    return (
      <div data-slot="sandbox-banner-invalid" role="alert" className="border-b border-destructive/30 bg-destructive/5">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm sm:px-6">
          <p className="min-w-0 flex-1 break-words">
            The stored sandbox session could not be read ({sandboxError}), so you are on X Layer mainnet.
          </p>
          <Button variant="outline" size="sm" onClick={endSandbox}>
            Forget it
          </Button>
        </div>
      </div>
    )
  }
  if (!hydrated || mode !== "sandbox" || !sandbox) return null
  return (
    <div data-slot="sandbox-banner" role="status" className="border-b bg-muted/50">
      <div className="mx-auto flex h-10 w-full max-w-7xl items-center gap-1.5 whitespace-nowrap px-4 text-[11px] sm:gap-3 sm:px-6 sm:text-xs">
        <FlaskConicalIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="font-medium">Sandbox</span>
        <span className="text-muted-foreground"><ChainTime /></span>
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-1 text-[11px] sm:px-2 sm:text-xs">Details</Button></PopoverTrigger>
          <PopoverContent>
            <p className="font-medium">Sandbox simulation</p>
            <p className="text-muted-foreground">A private fork of X Layer mainnet. No mainnet funds move.</p>
            <dl className="grid gap-1 text-xs">
              <div className="flex justify-between"><dt>Fork block</dt><dd className="tabular-nums">{sandbox.forkBlock}</dd></div>
              <div className="flex justify-between"><dt>Chain ID</dt><dd className="tabular-nums">{sandbox.chainId}</dd></div>
            </dl>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" className="ml-auto h-7 px-1 text-[11px] sm:px-2 sm:text-xs" onClick={endSandbox}>Exit sandbox</Button>
      </div>
    </div>
  )
}
