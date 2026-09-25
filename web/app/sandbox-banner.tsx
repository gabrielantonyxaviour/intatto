"use client"

import { useQuery } from "@tanstack/react-query"
import { FlaskConicalIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { Button } from "@/components/ui/button"
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
    return <time dateTime={new Date(Number(block.data.timestamp) * 1000).toISOString()}>{formatUtc(block.data.timestamp)}</time>
  }
  if (block.isError) return <span className="text-destructive">unavailable (fork RPC not reachable)</span>
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
    <div data-slot="sandbox-banner" role="status" className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm sm:px-6">
        <FlaskConicalIcon aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="font-medium">Sandbox</span> · fork of X Layer mainnet at block {sandbox.forkBlock} · chain{" "}
          {sandbox.chainId} · chain time <ChainTime />
        </p>
        <Button variant="outline" size="sm" onClick={endSandbox}>
          Exit sandbox
        </Button>
      </div>
    </div>
  )
}
