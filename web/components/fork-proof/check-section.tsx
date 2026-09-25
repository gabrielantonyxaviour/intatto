"use client"

import type { ReactNode } from "react"
import { CircleAlertIcon, CircleXIcon, UnplugIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EvidenceSheet } from "@/components/ui/ix"
import { formatUtc } from "@/components/ui/web3/format"
import { SIDE_NAME } from "./rpc"
import { CommandBlock, StatusMark } from "./primitives"
import type { CheckId, Outcome } from "./types"

export type CheckSectionProps<E> = {
  id: CheckId
  number: number
  title: string
  proves: ReactNode
  summary: (e: E) => string
  outcome: Outcome<E>
  /** Evidence and cast commands, rendered once the check has a result. */
  evidence: (e: E) => ReactNode
  commands?: (e: E) => string[]
  /** Names of the compared items that differ, listed at the top when the check fails. */
  differences?: (e: E) => string[]
}

/** Keep verdicts and failures inline; one direct sheet holds all raw evidence and commands. */
export function CheckSection<E>({ id, number, title, proves, summary, outcome, evidence, commands, differences }: CheckSectionProps<E>) {
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
              <p className="wrap-anywhere">
                {outcome.url ? `${outcome.url}: ` : ""}
                {outcome.message}
              </p>
              <p>No answer came back (network, HTTP or timeout), so this check has neither passed nor failed. Re-run once the RPC answers.</p>
            </AlertDescription>
          </Alert>
        ) : null}
        {outcome.status === "refused" ? (
          <Alert variant="warning" data-slot="refused">
            <CircleAlertIcon aria-hidden />
            <AlertTitle className="line-clamp-none">The {SIDE_NAME[outcome.side]} refused a read</AlertTitle>
            <AlertDescription>
              <p className="wrap-anywhere">
                {outcome.method ? `${outcome.method}` : "A read"}
                {outcome.code !== null ? ` answered JSON-RPC error ${outcome.code}` : " answered an error"}: {outcome.message}
              </p>
              <p className="wrap-anywhere">{outcome.url}</p>
              <p>The RPC is up but would not serve this read, so the check has neither passed nor failed.</p>
            </AlertDescription>
          </Alert>
        ) : null}
        {outcome.status === "skipped" ? <p className="text-sm text-muted-foreground">{outcome.reason}</p> : null}
        {outcome.status === "pass" || outcome.status === "fail" ? (
          <>
            {outcome.status === "fail" && differences ? <Differences items={differences(outcome.evidence)} /> : null}
            <p className="text-sm" data-slot="coverage">{summary(outcome.evidence)}</p>
            <EvidenceSheet
              title={`Check ${number}: ${title}`}
              triggerLabel={`Raw values: ${{ blocks: "block hashes", bytecode: "contract code", state: "state reads", intatto: "Intatto code" }[id]}`}
              summary={typeof proves === "string" ? proves : "Direct sandbox and X Layer RPC comparison."}
              asOf={`Completed ${formatUtc(Math.floor(outcome.finishedAt / 1000))}`}
              state="ready"
              evidenceFor={id}
            >
              <div className="grid min-w-0 gap-4">
                {evidence(outcome.evidence)}
                <section className="grid min-w-0 gap-2" aria-label={`Reproduce check ${number} with cast`}>
                  <h3 className="text-sm font-medium">Reproduce with cast</h3>
                  {commands ? <CommandBlock lines={commands(outcome.evidence)} label={`cast commands for check ${number}`} />
                    : <p className="text-sm text-muted-foreground">Commands are unavailable until the reference RPC and fork block are known.</p>}
                </section>
              </div>
            </EvidenceSheet>
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
        {items.length} {items.length === 1 ? "difference" : "differences"} from the reference
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {items.map((d) => (
            <li key={d} className="wrap-anywhere">
              {d}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
