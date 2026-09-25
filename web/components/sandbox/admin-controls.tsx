"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, CircleAlertIcon, CircleCheckIcon, ClockIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"
import type { UseMutationResult } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatUtc } from "@/components/ui/web3/format"
import { requestKey, type ActionResult, type AdminRequest } from "./api"
import { RESET, requestLabel, WARPS } from "./copy"

export type Admin = UseMutationResult<ActionResult, Error, AdminRequest>

/** Which control is running right now (its request key), or null. */
export const runningKey = (admin: Admin) => (admin.isPending && admin.variables ? requestKey(admin.variables) : null)

export function ActionButton({ admin, request, label, busy, variant = "default" }: { admin: Admin; request: AdminRequest; label: string; busy: string; variant?: "default" | "outline" }) {
  const running = runningKey(admin) === requestKey(request)
  return (
    <Button variant={variant} disabled={admin.isPending} aria-busy={running} onClick={() => admin.mutate(request)} className="justify-self-start">
      {running ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
      {running ? busy : label}
    </Button>
  )
}

export function LookAt({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
      Look at {label}
      <ArrowRightIcon aria-hidden className="size-3.5" />
    </Link>
  )
}

/** The last admin action's outcome: what ran, how many ledger entries it wrote, and where the clock is now. */
export function ActionOutcome({ admin }: { admin: Admin }) {
  if (admin.isError && admin.variables) {
    return (
      <Alert variant="destructive" data-testid="action-error">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>{requestLabel(admin.variables)} did not complete</AlertTitle>
        <AlertDescription className="grid gap-2">
          <p className="break-words">{admin.error.message}</p>
          <Button variant="outline" size="sm" className="justify-self-start" onClick={() => admin.mutate(admin.variables!)}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (admin.isSuccess && admin.variables) {
    const { entries, chain } = admin.data
    return (
      <Alert variant="success" role="status" data-testid="action-result">
        <CircleCheckIcon aria-hidden />
        <AlertTitle>{requestLabel(admin.variables)}: done</AlertTitle>
        <AlertDescription>
          <p>
            {entries.length} admin {entries.length === 1 ? "call" : "calls"} written to the activity ledger
            {chain ? (
              <>
                {" "}
                · chain time {formatUtc(chain.chainTime)} · session {chain.session}
              </>
            ) : null}
            .
          </p>
        </AlertDescription>
      </Alert>
    )
  }
  return null
}

/** Time-travel controls named after what they do and the fork method under each. */
export function TimeTravel({ admin }: { admin: Admin }) {
  return (
    <Card data-testid="time-travel">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <ClockIcon aria-hidden className="size-4" />
            Time travel
          </h2>
        </CardTitle>
        <CardDescription>Move the fork&apos;s clock. The keeper then posts the session the calendar says, as it would on mainnet.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 xl:grid-cols-3">
        {WARPS.map((w) => (
          <div key={w.id} className="grid content-start gap-2 rounded-lg border p-3">
            <ActionButton admin={admin} request={{ kind: "warp", target: w.id }} label={w.label} busy={w.busy} />
            <p className="font-mono text-xs break-words text-muted-foreground">{w.method}</p>
            <p className="text-sm">{w.next}</p>
            <LookAt {...w.look} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** Snapshot and revert: back to the moment the burner was funded, with a confirmation step. */
export function ResetControl({ admin }: { admin: Admin }) {
  const [confirming, setConfirming] = useState(false)
  const running = runningKey(admin) === "reset"
  return (
    <Card data-testid="reset">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <RotateCcwIcon aria-hidden className="size-4" />
            {RESET.label}
          </h2>
        </CardTitle>
        <CardDescription>{RESET.next}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="font-mono text-xs break-words text-muted-foreground">{RESET.method}</p>
        {confirming && !running ? (
          <div role="group" aria-label="Confirm reset" className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Discard everything since the session started?</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={admin.isPending}
              onClick={() => {
                setConfirming(false)
                admin.mutate({ kind: "reset" })
              }}
            >
              Yes, reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="justify-self-start" disabled={admin.isPending} aria-busy={running} onClick={() => setConfirming(true)}>
            {running ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
            {running ? RESET.busy : "Reset…"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

