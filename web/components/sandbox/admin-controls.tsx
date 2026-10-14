"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, CircleAlertIcon, CircleCheckIcon, ClockIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"
import type { UseMutationResult } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DefinitionPopover } from "@/components/ui/ix"
import { requestKey, type ActionResult, type AdminRequest } from "./api"
import { RESET, requestLabel, WARPS } from "./copy"

export type Admin = UseMutationResult<ActionResult, Error, AdminRequest>

/** Which control is running right now (its request key), or null. */
export const runningKey = (admin: Admin) => (admin.isPending && admin.variables ? requestKey(admin.variables) : null)

export function ActionButton({ admin, request, label, busy, variant = "outline" }: { admin: Admin; request: AdminRequest; label: string; busy: string; variant?: "default" | "outline" | "ghost" }) {
  const running = runningKey(admin) === requestKey(request)
  return (
    <Button variant={variant} disabled={admin.isPending} aria-busy={running} onClick={() => admin.mutate(request)} className="h-auto min-h-9 max-w-full justify-self-start whitespace-normal text-left">
      {running ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
      {running ? busy : label}
    </Button>
  )
}

export function LookAt({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
      {label}
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
          <Button variant="outline" size="sm" className="h-auto min-h-9 max-w-full justify-self-start whitespace-normal text-left" onClick={() => admin.mutate(admin.variables!)}>
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
            {entries.length} {entries.length === 1 ? "call" : "calls"} recorded
            {chain ? (
              <>
                {" "}
                · {chain.session}
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

/** Shared by the page and the dock; all mutations use the existing admin hook. */
export function TimeTravel({ admin }: { admin: Admin }) {
  return (
    <section data-testid="time-travel" className="grid min-w-0 gap-3">
      <div className="flex items-center gap-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ClockIcon aria-hidden className="size-4" />Time travel</h3>
        <DefinitionPopover term="Time travel"><p>The keeper posts the calendar session and a simulated pool-derived price after each clock change.</p>
          {WARPS.map((w) => <p key={w.id} className="mt-2 text-xs"><strong>{w.label}:</strong> {w.method}. {w.next}</p>)}
        </DefinitionPopover>
      </div>
      <div className="flex flex-wrap gap-2">{WARPS.map((w) => <ActionButton key={w.id} admin={admin} request={{ kind: "warp", target: w.id }} label={w.label} busy={w.busy} />)}</div>
    </section>
  )
}

/** Snapshot and revert: back to the moment the burner was funded, with a confirmation step. */
export function ResetControl({ admin }: { admin: Admin }) {
  const [confirming, setConfirming] = useState(false)
  const running = runningKey(admin) === "reset"
  return (
    <section data-testid="reset" className="grid gap-3 border-t pt-4">
      <div className="flex items-center gap-1">

          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <RotateCcwIcon aria-hidden className="size-4" />
            {RESET.label}
          </h3>

        <DefinitionPopover term="Reset session"><p>{RESET.next}</p><p className="mt-2 font-mono text-xs">{RESET.method}</p></DefinitionPopover>
      </div>
      <div className="grid gap-3">

        {confirming && !running ? (
          <div role="group" aria-label="Confirm reset" className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Revert this fork to the moment the burner was funded? The ledger keeps every call.</span>
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
          <Button variant="outline" className="h-auto min-h-9 max-w-full justify-self-start whitespace-normal text-left" disabled={admin.isPending} aria-busy={running} onClick={() => setConfirming(true)}>
            {running ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
            {running ? RESET.busy : "Reset…"}
          </Button>
        )}
      </div>
    </section>
  )
}

