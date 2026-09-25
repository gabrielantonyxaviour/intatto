"use client"

import { CircleAlertIcon, Loader2Icon, PlayIcon, RotateCwIcon, TimerOffIcon, TriangleAlertIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useStartSession } from "./start-session"

/** The sandbox service did not answer (or answered with an error) — nothing can be started or controlled. */
export function ApiUnavailable({ base, message, onRetry }: { base: string | null; message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive" data-testid="sandbox-unavailable">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>The sandbox service is unavailable</AlertTitle>
      <AlertDescription className="grid gap-1">
        <p className="break-words">{message}</p>
        {base ? <p className="break-all font-mono text-xs">{base}</p> : null}
        <p>Sessions cannot be started or controlled until it answers. Nothing on X Layer mainnet is affected.</p>
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

/** The fork's RPC failed or answers as a different chain than the session expects. */
export function RpcProblem({ kind, detail, onRetry }: { kind: "unreachable" | "wrong-network"; detail: string; onRetry: () => void }) {
  const { endSandbox } = useIntatto()
  return (
    <Alert variant={kind === "wrong-network" ? "warning" : "destructive"} data-testid={kind === "wrong-network" ? "sandbox-wrong-network" : "sandbox-rpc-error"}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>{kind === "wrong-network" ? "This RPC is not the session's fork" : "The fork's RPC did not answer"}</AlertTitle>
      <AlertDescription className="grid gap-2">
        <p className="break-words">{detail}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon aria-hidden />
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={endSandbox}>
            End session
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

/** Idle for 30 minutes (or gone from the service): its fork stopped. Start a new one or go back to mainnet. */
export function SessionGone({ base, reason }: { base: string | null; reason: "expired" | "failed" | "missing" }) {
  const { endSandbox } = useIntatto()
  const start = useStartSession(base)
  const text = {
    expired: "This session expired after 30 idle minutes and its fork has stopped. Nothing you did there carries over; the ledger stays readable below.",
    failed: "This session failed to start, so it has no fork to control.",
    missing: "The sandbox service no longer knows this session (it may have restarted). Its fork is gone.",
  }[reason]
  return (
    <Card data-testid="session-expired">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <TimerOffIcon aria-hidden className="size-4" />
            {reason === "expired" ? "Session expired" : reason === "failed" ? "Session failed" : "Session not found"}
          </h2>
        </CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {start.isError ? (
        <CardContent>
          <p role="alert" className="break-words text-sm text-destructive">
            {start.error.message}
          </p>
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap gap-2">
        <Button onClick={() => start.mutate()} disabled={!base || start.isPending} aria-busy={start.isPending}>
          {start.isPending ? <Loader2Icon aria-hidden className="animate-spin" /> : <PlayIcon aria-hidden />}
          {start.isPending ? "Starting your fork…" : "Start a new session"}
        </Button>
        <Button variant="outline" onClick={endSandbox}>
          Back to X Layer mainnet
        </Button>
      </CardFooter>
    </Card>
  )
}

/** A stored session without a sandbox API (a bare local fork): chain reads work, admin controls do not. */
export function NoApi() {
  return (
    <Alert variant="info" data-testid="sandbox-no-api">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>This session has no sandbox API</AlertTitle>
      <AlertDescription>
        It points at a bare fork, so time travel, scenarios, reset and the ledger are not available here. End it and start a
        session to get them.
      </AlertDescription>
    </Alert>
  )
}

export function ControlsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the session" data-testid="sandbox-loading" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid content-start gap-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}
