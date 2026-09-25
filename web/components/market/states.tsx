"use client"

import Link from "next/link"
import { CircleAlertIcon, FlaskConicalIcon, RotateCwIcon } from "lucide-react"
import { liveDeploymentError } from "@/lib/chain"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Live mode before Intatto is on X Layer: say so and point at the sandbox. */
export function NotDeployed() {
  return (
    <Card data-testid="market-not-deployed" className="max-w-2xl">
      <CardHeader>
        <CardTitle>Intatto is not deployed on X Layer yet</CardTitle>
        <CardDescription>
          There is no market to read on X Layer mainnet today. The sandbox runs the same contracts on a fork of X Layer with
          real NVDAx, USDG and pool state, and a funded throwaway wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {liveDeploymentError ? (
          <p className="text-sm text-destructive">The configured deployment could not be read: {liveDeploymentError}</p>
        ) : null}
        <div>
          <Button asChild>
            <Link href="/sandbox">
              <FlaskConicalIcon aria-hidden />
              Try the sandbox
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** An RPC read failed; keep whatever else rendered and offer a retry. */
export function LoadError({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  const detail = error instanceof Error ? error.message.split("\n")[0] : String(error)
  return (
    <Alert variant="destructive" data-testid="market-load-error">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>Could not read {what}</AlertTitle>
      <AlertDescription>
        <p className="break-all">The RPC did not answer: {detail}</p>
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCwIcon aria-hidden />
          Retry
        </Button>
      </AlertAction>
    </Alert>
  )
}

export function StatsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading market totals" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading market detail" className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 lg:col-span-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
