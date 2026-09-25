"use client"

/** Shared pieces every view uses: section frame, loading, empty and error states, and a transaction reference. */
import type { ReactNode } from "react"
import Link from "next/link"
import { CircleAlertIcon, InboxIcon, RotateCwIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ExplorerLink } from "@/components/ui/web3"
import { useIntatto } from "@/lib/chain"

export function Section({ id, title, description, actions, children }: { id: string; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} data-section={id} className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-0 gap-1">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function Panel({ title, description, children, className }: { title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`grid min-w-0 grid-cols-1 content-start gap-3 rounded-xl border bg-card p-4 ${className ?? ""}`}>
      {title ? (
        <div className="grid gap-0.5">
          <h3 className="text-sm font-medium">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function RowsSkeleton({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-2" data-state="loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div data-state="empty" className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      <InboxIcon aria-hidden className="size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function LoadError({ what, error, onRetry }: { what: string; error: Error | null; onRetry?: () => void }) {
  const detail = error?.message.split("\n")[0]?.slice(0, 180)
  return (
    <Alert variant="destructive" data-state="error">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>Could not read {what}</AlertTitle>
      <AlertDescription>
        <p>The RPC did not answer{detail ? `: ${detail}` : "."} Numbers shown elsewhere may be older.</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon aria-hidden />
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

/** A transaction: an OKLink link on X Layer, the hash as text on a sandbox fork. `data-tx` carries the full hash. */
export function TxRef({ hash }: { hash: string }) {
  return (
    <span data-tx={hash} className="inline-flex">
      <ExplorerLink hash={hash} className="font-mono text-xs" />
    </span>
  )
}

export function NotDeployed() {
  const { mode, sandboxError } = useIntatto()
  return (
    <Alert data-state="not-deployed">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>{mode === "live" ? "Intatto is not deployed on X Layer yet" : "This sandbox has no NVDAx market"}</AlertTitle>
      <AlertDescription>
        <p>
          The risk console reads the market&apos;s contracts and their events. There is nothing onchain to show yet
          {sandboxError ? " (the stored sandbox session could not be read)" : ""}. Try the sandbox: a fork of X Layer with
          Intatto deployed, where the keeper&apos;s posts, rejections and liquidations are real transactions.
        </p>
        <Button asChild size="sm">
          <Link href="/sandbox">Open the sandbox</Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
