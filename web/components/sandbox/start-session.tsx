"use client"

import { useMutation } from "@tanstack/react-query"
import { CircleAlertIcon, Loader2Icon, PlayIcon } from "lucide-react"
import { privateKeyToAccount } from "viem/accounts"
import { SANDBOX_CHAIN_ID, XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { sandboxSessionSchema, useIntatto, type SandboxSession } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { SandboxApiError, sandboxApi, type Health } from "./api"
import { START_METHOD } from "./copy"

/** POST /session, validated, then stored: every screen switches to the fork with the burner connected. */
export function useStartSession(base: string | null) {
  const { startSandbox } = useIntatto()
  return useMutation<SandboxSession, Error>({
    mutationKey: ["sandbox-start", base],
    mutationFn: async () => {
      if (!base) throw new Error("There is no sandbox service to start a session on.")
      const created = await sandboxApi.create(base)
      if (created.chainId !== SANDBOX_CHAIN_ID) {
        throw new SandboxApiError(0, "wrong_chain", `The service offered chain ${created.chainId}; a sandbox must use chain ${SANDBOX_CHAIN_ID}.`)
      }
      if (privateKeyToAccount(created.burnerKey as `0x${string}`).address.toLowerCase() !== created.burnerAddress.toLowerCase()) {
        throw new SandboxApiError(0, "bad_response", "The service's burner key does not match its burner address.")
      }
      const parsed = sandboxSessionSchema.safeParse({ ...created, apiUrl: base })
      if (!parsed.success) throw new SandboxApiError(0, "bad_response", "The service returned a session this page cannot store.")
      return parsed.data
    },
    onSuccess: (session) => startSandbox(session),
  })
}

function ReadOnlyField({ id, label, value, hint }: { id: string; label: string; value: string; hint: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} readOnly aria-describedby={`${id}-hint`} className="font-mono" />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}

/** Tenderly-style creation form, reduced to what the sandbox supports: every field is fixed by the snapshot. */
export function StartSession({ base, health }: { base: string | null; health: Health | undefined }) {
  const start = useStartSession(base)
  const ready = Boolean(base && health?.ok)
  return (
    <Card data-testid="start-session">
      <CardHeader>
        <CardTitle>
          <h2>Start a session</h2>
        </CardTitle>
        <CardDescription>
          Your own fork of X Layer mainnet with Intatto deployed and a throwaway wallet. Nothing here touches real funds.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField id="sandbox-parent" label="Parent network" value={`X Layer mainnet (${XLAYER_CHAIN_ID})`} hint="The only network Intatto runs on." />
          <ReadOnlyField
            id="sandbox-fork-block"
            label="Fork block"
            value={health ? formatNumber(health.forkBlock) : "…"}
            hint={health?.snapshotCreatedAt ? `Fixed by the snapshot built ${formatUtc(Date.parse(health.snapshotCreatedAt) / 1000)}.` : "Fixed by the snapshot."}
          />
          <ReadOnlyField
            id="sandbox-chain-id"
            label="Custom chain id"
            value={String(health?.chainId ?? SANDBOX_CHAIN_ID)}
            hint="Differs from 196, so nothing signed here can be replayed on mainnet."
          />
          <ReadOnlyField
            id="sandbox-state-sync"
            label="State sync"
            value="Off"
            hint="The fork stays frozen at the fork block; later X Layer blocks never reach it."
          />
        </div>
        <p className="text-sm text-muted-foreground">{START_METHOD}</p>
        {start.isError ? (
          <Alert variant="destructive" data-testid="start-error">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>The session did not start</AlertTitle>
            <AlertDescription>
              <p className="break-words">{start.error.message}</p>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        <Button onClick={() => start.mutate()} disabled={!ready || start.isPending} aria-busy={start.isPending}>
          {start.isPending ? <Loader2Icon aria-hidden className="animate-spin" /> : <PlayIcon aria-hidden />}
          {start.isPending ? "Starting your fork…" : start.isError ? "Try again" : "Start a session"}
        </Button>
        {start.isPending ? (
          <span role="status" className="text-sm text-muted-foreground">
            Loading the snapshot, posting the keeper&apos;s session and prices, funding your burner. About 10–30 seconds.
          </span>
        ) : null}
      </CardFooter>
    </Card>
  )
}
