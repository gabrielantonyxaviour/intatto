"use client"

import Link from "next/link"
import { useSwitchChain } from "wagmi"
import { CircleAlertIcon, FlaskConicalIcon, TriangleAlertIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function NotDeployed({ symbol = "NVDAx" }: { symbol?: string }) {
  const { mode } = useIntatto()
  return (
    <Card data-testid="borrow-not-deployed" className="max-w-xl">
      <CardHeader>
        <CardTitle>{mode === "live" ? "Intatto is not deployed on X Layer yet" : `This sandbox has no ${symbol} market`}</CardTitle>
        <CardDescription>
          {mode === "live"
            ? "There is no market to borrow from on X Layer mainnet yet. The sandbox runs the same contracts on a fork of X Layer with a funded test wallet, so you can try every step there."
            : `The sandbox session's deployment does not include a ${symbol} market. Start a fresh session.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/sandbox">
            <FlaskConicalIcon aria-hidden />
            Try the sandbox
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function LoadError({ error, retry }: { error: Error | null; retry: () => void }) {
  const { rpcUrl, mode } = useIntatto()
  return (
    <Alert variant="destructive" data-testid="borrow-error">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>Could not read the market</AlertTitle>
      <AlertDescription>
        <p>
          The {mode === "sandbox" ? "sandbox fork" : "X Layer"} RPC at <span className="break-all font-mono">{rpcUrl}</span> did not
          answer. Your funds are not affected.
        </p>
        {error ? (
          <details>
            <summary className="cursor-pointer select-none">More details</summary>
            <pre className="mt-1 max-h-40 overflow-auto text-[11px] break-all whitespace-pre-wrap">{error.message}</pre>
          </details>
        ) : null}
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      </AlertAction>
    </Alert>
  )
}

export function WrongNetwork() {
  const { chain } = useIntatto()
  const { switchChain, isPending } = useSwitchChain()
  return (
    <Alert variant="warning" data-testid="borrow-wrong-network">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>Your wallet is on another network</AlertTitle>
      <AlertDescription>Numbers below are read from {chain.name}. Switch your wallet to {chain.name} to sign.</AlertDescription>
      <AlertAction>
        <Button size="sm" disabled={isPending} onClick={() => switchChain({ chainId: chain.id })}>
          Switch to {chain.name}
        </Button>
      </AlertAction>
    </Alert>
  )
}

export function BorrowSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the market" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="grid gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-28" />
        <Skeleton className="h-10" />
      </div>
      <div className="grid content-start gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}
