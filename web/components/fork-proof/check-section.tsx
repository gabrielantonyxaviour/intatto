"use client"

import type { ReactNode } from "react"
import { CircleXIcon, UnplugIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SIDE_NAME } from "./rpc"
import { CommandBlock, StatusMark } from "./primitives"
import type { CheckId, Outcome } from "./types"

export type CheckSectionProps<E> = {
  id: CheckId
  number: number
  title: string
  proves: ReactNode
  outcome: Outcome<E>
  /** Evidence and cast commands, rendered once the check has a result. */
  evidence: (e: E) => ReactNode
  commands?: (e: E) => string[]
  /** Names of the compared items that differ, listed at the top when the check fails. */
  differences?: (e: E) => string[]
}

/** One named check: its heading carries the verdict, and its raw evidence sits directly under it. */
export function CheckSection<E>({ id, number, title, proves, outcome, evidence, commands, differences }: CheckSectionProps<E>) {
  const headingId = `check-${id}-title`
  return (
    <Card aria-labelledby={headingId} data-check={id} data-status={outcome.status} className="gap-3">
      <CardHeader className="gap-1.5">
        <h2 id={headingId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-medium">
          <span>
            Check {number}: {title}
          </span>
          <StatusMark status={outcome.status} />
        </h2>
        <CardDescription>{proves}</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        {outcome.status === "running" ? (
          <div aria-busy="true" aria-label={`Check ${number} is running`} className="grid gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : null}
        {outcome.status === "unreachable" ? (
          <Alert variant="warning" data-slot="unreachable">
            <UnplugIcon aria-hidden />
            <AlertTitle className="line-clamp-none">Could not reach the {SIDE_NAME[outcome.side]}</AlertTitle>
            <AlertDescription>
              <p className="break-all">
                {outcome.url ? `${outcome.url}: ` : ""}
                {outcome.message}
              </p>
              <p>This check did not run, so it has neither passed nor failed. Re-run once the RPC answers.</p>
            </AlertDescription>
          </Alert>
        ) : null}
        {outcome.status === "skipped" ? <p className="text-sm text-muted-foreground">{outcome.reason}</p> : null}
        {outcome.status === "pass" || outcome.status === "fail" ? (
          <>
            {outcome.status === "fail" && differences ? <Differences items={differences(outcome.evidence)} /> : null}
            {evidence(outcome.evidence)}
            {commands ? (
              <details className="group grid gap-2">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Reproduce with cast</summary>
                <div className="mt-2">
                  <CommandBlock lines={commands(outcome.evidence)} label={`cast commands for check ${number}`} />
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Differences({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <Alert variant="destructive" data-slot="differences">
      <CircleXIcon aria-hidden />
      <AlertTitle className="line-clamp-none">
        {items.length} {items.length === 1 ? "difference" : "differences"} from X Layer
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {items.map((d) => (
            <li key={d} className="break-words">
              {d}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
